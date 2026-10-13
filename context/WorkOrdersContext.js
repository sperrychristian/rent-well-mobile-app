import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { work_orders } from '../data/workOrders';
import { seed_expenses } from '../data/expenses';
import {
  seed_trips,
  seed_budgets,
  seed_recurring_rules,
  default_mileage_rate,
} from '../data/expenseExtras';
import { seed_documents } from '../data/documents';
import { todayString } from '../utils/formatDate';
import { storageKey } from '../utils/storageKeys';
import { addPeriod } from '../utils/recurring';
import { deleteDocumentFile, clearDemoFiles } from '../features/documents/utils/documentFiles';
import { sample_checklists } from '../features/checklist/data/sampleChecklists';
import { checklist_templates } from '../features/checklist/data/checklistTemplates';
import {
  copyTemplate,
  buildMoveOutRooms,
  makeItem,
  makeRoom,
  updateItemIn,
  addItemTo,
  removeItemFrom,
  photoNames,
} from '../features/checklist/utils/checklistHelpers';
import {
  deleteChecklistPhoto,
  clearDemoChecklistPhotos,
} from '../features/checklist/utils/checklistPhotos';
import { RemoteWorkOrdersContext } from '../features/workOrders/context/remoteWorkOrdersContext';

const orders_key = 'rent_well_work_orders';
const expenses_key = 'rent_well_expenses';
const extras_key = 'rent_well_extras';
const documents_key = 'rent_well_documents';
const checklists_key = 'rent_well_checklists';

const WorkOrdersContext = createContext(null);

// ids from the clock alone can repeat when several things are added in the same millisecond, so I add random letters
function makeId() {
  return Date.now().toString() + '-' + Math.random().toString(36).slice(2, 7);
}

// expenses used to live inside each work order, this pulls them out into the shared expense list
function splitOrder(order, collected_expenses) {
  (order.expenses || []).forEach((old_expense) => {
    collected_expenses.push({
      id: old_expense.id,
      amount: old_expense.amount,
      category: 'Repairs',
      date: todayString(),
      property: order.property,
      vendor: '',
      payment_method: 'Other',
      is_capital: false,
      notes: old_expense.description || '',
      receipts: old_expense.photo_uri ? [old_expense.photo_uri] : [],
      work_order_id: order.id,
    });
  });
  const { expenses, ...order_without_expenses } = order;
  return order_without_expenses;
}

// the starting orders, also what the demo resets to every time it starts
const default_orders = work_orders.map((order) => splitOrder(order, []));

export function WorkOrdersProvider(props) {
  // start with the mock data and swap in saved data once it loads
  const [orders, setOrders] = useState(default_orders);
  const [expenses, setExpenses] = useState(seed_expenses);
  const [trips, setTrips] = useState(seed_trips);
  const [recurring_rules, setRecurringRules] = useState(seed_recurring_rules);
  const [budgets, setBudgets] = useState(seed_budgets);
  const [mileage_rate, setMileageRate] = useState(default_mileage_rate);
  const [documents, setDocuments] = useState(seed_documents);
  // checklists start empty, the samples only show up in the demo
  const [checklists, setChecklists] = useState([]);
  // I wait for the saved data to load before saving anything, so the mock data can't overwrite it
  // loaded_user is whose data is in memory (null for the original keys), so switching accounts counts as not loaded yet
  const [loaded_user, setLoadedUser] = useState(undefined);
  const current_user = props.user_id || null;
  const loaded = loaded_user === current_user;
  // the saves read this, it only changes once the new account's data is actually in state
  const storage_user_ref = useRef(null);
  // the newest load wins, an older one that finishes late is ignored
  const load_count = useRef(0);
  // demo mode runs on sample data and never saves, so real data is never touched
  const [demo_mode, setDemoMode] = useState(false);
  // the ref changes right away, which the async load needs to check, state only updates on the next render
  const demo_ref = useRef(false);

  // reads whatever was saved on the device, used on startup and when leaving the demo
  // user_id picks which account's keys to read, gives back false if a newer load or the demo took over
  async function loadSavedData(user_id) {
    load_count.current++;
    const this_load = load_count.current;
    try {
      const saved_orders_text = await AsyncStorage.getItem(storageKey(orders_key, user_id));
      const saved_expenses_text = await AsyncStorage.getItem(storageKey(expenses_key, user_id));
      const saved_extras_text = await AsyncStorage.getItem(storageKey(extras_key, user_id));
      const saved_documents_text = await AsyncStorage.getItem(storageKey(documents_key, user_id));
      const saved_checklists_text = await AsyncStorage.getItem(storageKey(checklists_key, user_id));
      const migrated_expenses = [];

      // if the demo started while this was loading, I leave the demo data alone
      if (demo_ref.current || this_load !== load_count.current) {
        return false;
      }
      storage_user_ref.current = user_id;

      if (saved_orders_text !== null) {
        const saved_orders = JSON.parse(saved_orders_text);
        setOrders(saved_orders.map((order) => splitOrder(order, migrated_expenses)));
      } else {
        setOrders(default_orders);
      }

      if (saved_expenses_text !== null) {
        setExpenses(JSON.parse(saved_expenses_text));
      } else if (migrated_expenses.length > 0) {
        setExpenses([...migrated_expenses, ...seed_expenses]);
      } else {
        setExpenses(seed_expenses);
      }

      if (saved_extras_text !== null) {
        const saved_extras = JSON.parse(saved_extras_text);
        setTrips(saved_extras.trips || []);
        setRecurringRules(saved_extras.recurring_rules || []);
        setBudgets(saved_extras.budgets || {});
        setMileageRate(
          saved_extras.mileage_rate !== undefined
            ? saved_extras.mileage_rate
            : default_mileage_rate,
        );
      } else {
        setTrips(seed_trips);
        setRecurringRules(seed_recurring_rules);
        setBudgets(seed_budgets);
        setMileageRate(default_mileage_rate);
      }

      if (saved_documents_text !== null) {
        setDocuments(JSON.parse(saved_documents_text));
      } else {
        setDocuments(seed_documents);
      }

      setChecklists(saved_checklists_text !== null ? JSON.parse(saved_checklists_text) : []);
    } catch (error) {
      console.log('Could not load saved data', error);
      if (this_load !== load_count.current) {
        return false;
      }
      storage_user_ref.current = user_id;
    }
    return true;
  }

  // loads again whenever a different account signs in
  useEffect(() => {
    loadSavedData(current_user).then((applied) => {
      if (applied) {
        setLoadedUser(current_user);
      }
    });
  }, [current_user]);

  // save every time the orders change, but not until the first load is done and never during the demo
  useEffect(() => {
    if (!loaded || demo_mode) {
      return;
    }
    AsyncStorage.setItem(
      storageKey(orders_key, storage_user_ref.current),
      JSON.stringify(orders),
    ).catch((error) => {
      console.log('Could not save work orders', error);
    });
  }, [orders, loaded, demo_mode]);

  useEffect(() => {
    if (!loaded || demo_mode) {
      return;
    }
    AsyncStorage.setItem(
      storageKey(expenses_key, storage_user_ref.current),
      JSON.stringify(expenses),
    ).catch((error) => {
      console.log('Could not save expenses', error);
    });
  }, [expenses, loaded, demo_mode]);

  // trips, recurring rules, budgets, and the mileage rate share one saved entry
  useEffect(() => {
    if (!loaded || demo_mode) {
      return;
    }
    const extras = {
      trips: trips,
      recurring_rules: recurring_rules,
      budgets: budgets,
      mileage_rate: mileage_rate,
    };
    AsyncStorage.setItem(
      storageKey(extras_key, storage_user_ref.current),
      JSON.stringify(extras),
    ).catch((error) => {
      console.log('Could not save trips and settings', error);
    });
  }, [trips, recurring_rules, budgets, mileage_rate, loaded, demo_mode]);

  // documents get their own saved entry, only the stored file name is saved, never the full path
  useEffect(() => {
    if (!loaded || demo_mode) {
      return;
    }
    AsyncStorage.setItem(
      storageKey(documents_key, storage_user_ref.current),
      JSON.stringify(documents),
    ).catch((error) => {
      console.log('Could not save documents', error);
    });
  }, [documents, loaded, demo_mode]);

  // checklists get their own entry too, photos are saved by stored name only like documents
  useEffect(() => {
    if (!loaded || demo_mode) {
      return;
    }
    AsyncStorage.setItem(
      storageKey(checklists_key, storage_user_ref.current),
      JSON.stringify(checklists),
    ).catch((error) => {
      console.log('Could not save checklists', error);
    });
  }, [checklists, loaded, demo_mode]);

  // works out which recurring expenses are due, the id comes from the rule and the date so a repeat run can't double up
  function generateDue(rules) {
    const today = todayString();
    const created = [];
    const updated_rules = rules.map((rule) => {
      if (!rule.active) {
        return rule;
      }
      let next_date = rule.next_date;
      let safety_count = 0;
      // the safety count stops a bad date from looping forever
      while (next_date <= today && safety_count < 36) {
        created.push({
          ...rule.template,
          id: rule.id + '-' + next_date,
          date: next_date,
          receipts: [],
          work_order_id: null,
          recurring_id: rule.id,
        });
        next_date = addPeriod(next_date, rule.frequency, rule.anchor_day);
        safety_count++;
      }
      return next_date === rule.next_date ? rule : { ...rule, next_date: next_date };
    });
    return { created: created, updated_rules: updated_rules };
  }

  function applyDue(rules) {
    const result = generateDue(rules);
    if (result.created.length > 0) {
      setExpenses((current_expenses) => [
        ...current_expenses,
        ...result.created.filter(
          (item) => !current_expenses.some((expense) => expense.id === item.id),
        ),
      ]);
    }
    setRecurringRules(result.updated_rules);
  }

  // once the saved data is in, I add anything that came due since the app last ran, but not in the demo
  useEffect(() => {
    if (!loaded || demo_mode) {
      return;
    }
    applyDue(recurring_rules);
  }, [loaded]);

  // every demo starts from the same fresh sample data, and nothing in it gets saved
  function startDemo() {
    demo_ref.current = true;
    setOrders(default_orders);
    setExpenses(seed_expenses);
    setTrips(seed_trips);
    setRecurringRules(seed_recurring_rules);
    setBudgets(seed_budgets);
    setMileageRate(default_mileage_rate);
    setDocuments(seed_documents);
    setChecklists(sample_checklists);
    // clears out files left behind if the app was closed in the middle of a demo
    clearDemoFiles();
    clearDemoChecklistPhotos();
    setDemoMode(true);
  }

  // I put the real data back first and only then turn demo mode off, so demo data can't get saved over it
  async function exitDemo() {
    if (!demo_ref.current) {
      return;
    }
    demo_ref.current = false;
    if (await loadSavedData(current_user)) {
      setLoadedUser(current_user);
    }
    // files added during the demo lived in the cache and go away with it
    clearDemoFiles();
    clearDemoChecklistPhotos();
    setDemoMode(false);
  }

  // the work order screens still read order.expenses, so I build that list from the shared expenses here
  const orders_with_expenses = useMemo(
    () =>
      orders.map((order) => ({
        ...order,
        expenses: expenses
          .filter((expense) => expense.work_order_id === order.id)
          .map((expense) => ({
            id: expense.id,
            amount: expense.amount,
            description: expense.notes || expense.vendor,
            photo_uri: expense.receipts && expense.receipts.length > 0 ? expense.receipts[0] : null,
          })),
      })),
    [orders, expenses],
  );

  // every property name that shows up on an order, expense, or trip, for the pickers and filters
  const properties = useMemo(
    () =>
      [
        ...new Set([
          ...orders.map((order) => order.property),
          ...expenses.map((expense) => expense.property),
          ...trips.map((trip) => trip.property),
        ]),
      ]
        .filter(Boolean)
        .sort(),
    [orders, expenses, trips],
  );

  // one helper that swaps out only the matching order, the status actions use it
  function updateOrder(order_id, changes) {
    setOrders((current_orders) =>
      current_orders.map((order) => (order.id === order_id ? { ...order, ...changes } : order)),
    );
  }

  function startWorkOrder(order_id) {
    updateOrder(order_id, { status: 'In Progress', started_at: todayString() });
  }

  function resolveWorkOrder(order_id) {
    updateOrder(order_id, { status: 'Resolved', resolved_at: todayString() });
  }

  function setPriority(order_id, priority) {
    updateOrder(order_id, { priority: priority });
  }

  function setNotes(order_id, notes) {
    updateOrder(order_id, { notes: notes });
  }

  function setContractorInfo(order_id, contractor, estimate) {
    updateOrder(order_id, { contractor: contractor, estimate: estimate });
  }

  // a tenant submits a request and it starts out open with no landlord details filled in
  function addWorkOrder(request) {
    const new_order = {
      id: makeId(),
      title: request.title,
      description: request.description,
      property: request.property,
      tenant: request.tenant,
      status: 'Open',
      priority: request.priority,
      created_at: todayString(),
      started_at: null,
      resolved_at: null,
      notes: '',
      contractor: '',
      estimate: null,
      photo: request.photo,
    };
    setOrders((current_orders) => [...current_orders, new_order]);
  }

  // order_id can be null for an expense that isn't tied to a work order
  function addExpense(order_id, expense) {
    // repeat and split_properties are instructions for the screen, they don't belong on the saved expense
    const { repeat, split_properties, ...expense_fields } = expense;
    const new_expense = {
      category: 'Repairs',
      date: todayString(),
      property: '',
      vendor: '',
      payment_method: 'Other',
      is_capital: false,
      billed_to_tenant: false,
      recovered: 0,
      notes: '',
      receipts: [],
      ...expense_fields,
      id: makeId(),
      work_order_id: order_id || null,
    };
    setExpenses((current_expenses) => [...current_expenses, new_expense]);
  }

  function updateExpense(expense_id, changes) {
    setExpenses((current_expenses) =>
      current_expenses.map((expense) =>
        expense.id === expense_id ? { ...expense, ...changes } : expense,
      ),
    );
  }

  function deleteExpense(expense_id) {
    setExpenses((current_expenses) =>
      current_expenses.filter((expense) => expense.id !== expense_id),
    );
  }

  // puts a deleted expense back with its original id, used by the undo bar
  function restoreExpense(expense) {
    setExpenses((current_expenses) =>
      current_expenses.some((existing) => existing.id === expense.id)
        ? current_expenses
        : [...current_expenses, expense],
    );
  }

  function addTrip(trip) {
    setTrips((current_trips) => [...current_trips, { ...trip, id: makeId() }]);
  }

  function updateTrip(trip_id, changes) {
    setTrips((current_trips) =>
      current_trips.map((trip) => (trip.id === trip_id ? { ...trip, ...changes } : trip)),
    );
  }

  function deleteTrip(trip_id) {
    setTrips((current_trips) => current_trips.filter((trip) => trip.id !== trip_id));
  }

  // saves the expense once already, this makes the rule that adds the next ones and catches up any dates already past
  function addRecurringRule(template, frequency) {
    const anchor_day = parseInt(template.date.split('-')[2], 10);
    const { date, receipts, ...template_fields } = template;
    const new_rule = {
      id: 'rule-' + makeId(),
      frequency: frequency,
      anchor_day: anchor_day,
      next_date: addPeriod(date, frequency, anchor_day),
      active: true,
      template: template_fields,
    };
    applyDue([...recurring_rules, new_rule]);
  }

  function toggleRecurringRule(rule_id) {
    setRecurringRules((current_rules) =>
      current_rules.map((rule) => (rule.id === rule_id ? { ...rule, active: !rule.active } : rule)),
    );
  }

  function deleteRecurringRule(rule_id) {
    setRecurringRules((current_rules) => current_rules.filter((rule) => rule.id !== rule_id));
  }

  // the screen copies the file in first, so this only gets the finished document fields
  function addDocument(document) {
    const new_document = {
      tenant: '',
      expires_on: null,
      notes: '',
      shared_with_tenant: false,
      sample: false,
      ...document,
      id: makeId(),
      added_at: todayString(),
    };
    setDocuments((current_documents) => [...current_documents, new_document]);
  }

  function updateDocument(document_id, changes) {
    setDocuments((current_documents) =>
      current_documents.map((document) =>
        document.id === document_id ? { ...document, ...changes } : document,
      ),
    );
  }

  // the file goes with it, sample documents don't have one
  function deleteDocument(document_id) {
    const removed = documents.find((document) => document.id === document_id);
    if (removed && !removed.sample) {
      deleteDocumentFile(removed.stored_name, demo_ref.current);
    }
    setDocuments((current_documents) =>
      current_documents.filter((document) => document.id !== document_id),
    );
  }

  // move_in_id is set when a move-out starts from a move-in, so it copies those rooms and keeps their conditions
  // gives back the new id so the screen can open it right away
  function addChecklist(fields) {
    const move_in = fields.move_in_id
      ? checklists.find((checklist) => checklist.id === fields.move_in_id)
      : null;
    const rooms = move_in
      ? buildMoveOutRooms(move_in.rooms, checklist_templates['Move-Out'], makeId)
      : copyTemplate(checklist_templates[fields.type], makeId);
    const new_checklist = {
      id: makeId(),
      property: fields.property,
      type: fields.type,
      tenant: fields.tenant || '',
      created_at: todayString(),
      move_in_id: move_in ? move_in.id : null,
      completed: false,
      signed_by: '',
      signed_on: null,
      rooms: rooms,
    };
    setChecklists((current_checklists) => [...current_checklists, new_checklist]);
    return new_checklist.id;
  }

  // every room and item change goes through here, and a signed checklist is locked so it's skipped
  function editRooms(checklist_id, makeRooms) {
    setChecklists((current_checklists) =>
      current_checklists.map((checklist) =>
        checklist.id === checklist_id && !checklist.completed
          ? { ...checklist, rooms: makeRooms(checklist.rooms) }
          : checklist,
      ),
    );
  }

  // finds an open checklist, used before deleting photo files so a locked one never loses them
  function openChecklist(checklist_id) {
    return checklists.find((checklist) => checklist.id === checklist_id && !checklist.completed);
  }

  function updateChecklistItem(checklist_id, room_id, item_id, changes) {
    editRooms(checklist_id, (rooms) => updateItemIn(rooms, room_id, item_id, changes));
  }

  function addChecklistItem(checklist_id, room_id, name) {
    editRooms(checklist_id, (rooms) => addItemTo(rooms, room_id, makeItem(name, makeId)));
  }

  // the item's photos go with it
  function deleteChecklistItem(checklist_id, room_id, item_id) {
    const checklist = openChecklist(checklist_id);
    if (!checklist) {
      return;
    }
    const room = checklist.rooms.find((current_room) => current_room.id === room_id);
    const item = room ? room.items.find((current_item) => current_item.id === item_id) : null;
    if (item) {
      item.photos.forEach((stored_name) => deleteChecklistPhoto(stored_name, demo_ref.current));
    }
    editRooms(checklist_id, (rooms) => removeItemFrom(rooms, room_id, item_id));
  }

  // a new room starts empty and items get added to it one at a time
  function addChecklistRoom(checklist_id, name) {
    editRooms(checklist_id, (rooms) => [...rooms, makeRoom(name, [], makeId)]);
  }

  function deleteChecklistRoom(checklist_id, room_id) {
    const checklist = openChecklist(checklist_id);
    if (!checklist) {
      return;
    }
    const room = checklist.rooms.filter((current_room) => current_room.id === room_id);
    photoNames(room).forEach((stored_name) => deleteChecklistPhoto(stored_name, demo_ref.current));
    editRooms(checklist_id, (rooms) => rooms.filter((current_room) => current_room.id !== room_id));
  }

  // signing marks it complete, which locks every room and item from then on
  function signChecklist(checklist_id, signed_by, signed_on) {
    setChecklists((current_checklists) =>
      current_checklists.map((checklist) =>
        checklist.id === checklist_id && !checklist.completed
          ? { ...checklist, completed: true, signed_by: signed_by, signed_on: signed_on }
          : checklist,
      ),
    );
  }

  // deleting is still allowed on a signed checklist, and all its photos go with it
  function deleteChecklist(checklist_id) {
    const removed = checklists.find((checklist) => checklist.id === checklist_id);
    if (removed) {
      photoNames(removed.rooms).forEach((stored_name) =>
        deleteChecklistPhoto(stored_name, demo_ref.current),
      );
    }
    setChecklists((current_checklists) =>
      current_checklists.filter((checklist) => checklist.id !== checklist_id),
    );
  }

  function getOrder(order_id) {
    return orders_with_expenses.find((order) => order.id === order_id);
  }

  const value = {
    orders: orders_with_expenses,
    expenses,
    trips,
    recurring_rules,
    budgets,
    mileage_rate,
    documents,
    properties,
    demo_mode,
    startDemo,
    exitDemo,
    getOrder,
    startWorkOrder,
    resolveWorkOrder,
    setPriority,
    setNotes,
    setContractorInfo,
    addExpense,
    updateExpense,
    deleteExpense,
    restoreExpense,
    addTrip,
    updateTrip,
    deleteTrip,
    addRecurringRule,
    toggleRecurringRule,
    deleteRecurringRule,
    setBudgets,
    setMileageRate,
    addWorkOrder,
    addDocument,
    updateDocument,
    deleteDocument,
    checklists,
    addChecklist,
    updateChecklistItem,
    addChecklistItem,
    deleteChecklistItem,
    addChecklistRoom,
    deleteChecklistRoom,
    signChecklist,
    deleteChecklist,
  };

  return <WorkOrdersContext.Provider value={value}>{props.children}</WorkOrdersContext.Provider>;
}

// screens call this to get the shared orders, expenses, and actions
// in real mode the work order provider hands back the same shape with the orders coming from the server
export function useWorkOrders() {
  const local = useContext(WorkOrdersContext);
  const remote = useContext(RemoteWorkOrdersContext);
  return remote || local;
}
