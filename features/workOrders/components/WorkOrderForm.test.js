import { StyleSheet, TextInput, AccessibilityInfo } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import WorkOrderForm, { invalid_summary } from './WorkOrderForm';
import { LIGHT_COLORS, DARK_COLORS, setActiveScheme } from '../../../constants/theme';

// the work order form on its own: the lecture's behavior (one state object, errors on submit, typing
// clears an error, a valid submit calls onSubmit once), plus the counter, the date picker, the return keys,
// and the dirty flag the screen uses for the discard prompt

// the phone's date picker is native, so in tests it's a button that picks 2026-11-20 when pressed
jest.mock('@react-native-community/datetimepicker', () => {
  const { Pressable, Text } = require('react-native');
  function MockPicker(props) {
    return (
      <Pressable
        testID="mock-native-picker"
        onPress={() => props.onChange({ type: 'set' }, new Date(2026, 10, 20))}
      >
        <Text>{'min ' + (props.minimumDate ? props.minimumDate.getDate() : 'none')}</Text>
      </Pressable>
    );
  }
  return { __esModule: true, default: MockPicker, DateTimePickerAndroid: { open: jest.fn() } };
});

const today = '2026-11-04';

function renderForm(extra) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  const onDirtyChange = jest.fn();
  render(
    <WorkOrderForm
      submitButtonLabel="Add"
      onCancel={onCancel}
      onSubmit={onSubmit}
      onDirtyChange={onDirtyChange}
      variant="local_owner"
      showLandlordFields
      showDate
      showPhotos={false}
      properties={['123 Maple St, Unit 2']}
      today={today}
      {...(extra || {})}
    />,
  );
  return { onSubmit, onCancel, onDirtyChange };
}

function type(label, text) {
  fireEvent.changeText(screen.getByLabelText(label), text);
}

function fillValid() {
  type('Tenant name', 'Sam Rivera');
  type('Property', '123 Maple St, Unit 2');
  type('Title', '  Porch light out  ');
  type('Description', 'The bulb by the front door went out last night.');
  fireEvent.press(screen.getByLabelText('Normal priority'));
}

function hintOf(label) {
  return screen.getByLabelText(label).props.accessibilityHint || '';
}

function colorOf(element) {
  return StyleSheet.flatten(element.props.style).color;
}

beforeEach(() => {
  setActiveScheme('light');
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  TextInput.prototype.focus.mockClear();
});

afterEach(() => {
  AccessibilityInfo.announceForAccessibility.mockRestore();
});

afterAll(() => setActiveScheme('light'));

describe('submitting', () => {
  test('an empty submit shows a message next to every required field and saves nothing', () => {
    const { onSubmit } = renderForm();
    fireEvent.press(screen.getByText('Add'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Add the tenant's name.")).toBeTruthy();
    expect(screen.getByText('Pick the property or type it in.')).toBeTruthy();
    expect(screen.getByText('Add a title, like Kitchen faucet leaking.')).toBeTruthy();
    expect(screen.getByText('Describe the problem so it can get fixed.')).toBeTruthy();
    expect(screen.getByText('Pick how urgent it is.')).toBeTruthy();
    // each message belongs to its own box, a screen reader hears it on that field
    expect(hintOf('Title')).toContain('Add a title');
    expect(hintOf('Description')).toContain('Describe the problem');
    // the optional fields stay quiet
    expect(hintOf('Contractor (optional)')).toBe('');
    // the lecture's one line above the buttons
    expect(screen.getByText(invalid_summary)).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      invalid_summary + ". Add the tenant's name.",
    );
    // the first bad field gets the cursor
    const focused = TextInput.prototype.focus.mock.contexts.at(-1);
    expect(focused.props.accessibilityLabel).toBe('Tenant name');
  });

  test('every rule past required fails with its own message', () => {
    const { onSubmit } = renderForm();
    fillValid();
    type('Title', 'ab');
    type('Description', 'Too short');
    type('Estimated cost (optional)', '249.999');
    type('Preferred date (optional)', '2026-02-30');
    fireEvent.press(screen.getByText('Add'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('The title needs at least 3 characters.')).toBeTruthy();
    expect(
      screen.getByText('Add a bit more detail, at least 10 characters (you have 9).'),
    ).toBeTruthy();
    expect(screen.getByText('Use at most two decimal places, like 249.99.')).toBeTruthy();
    expect(screen.getByText("That date doesn't exist, check the month and day.")).toBeTruthy();

    type('Estimated cost (optional)', '150000');
    type('Preferred date (optional)', '2026-11-01');
    fireEvent.press(screen.getByText('Add'));
    expect(screen.getByText('The estimate has to be from $0 to $100,000.')).toBeTruthy();
    expect(screen.getByText('Pick today or a later date.')).toBeTruthy();

    type('Estimated cost (optional)', 'abc');
    type('Preferred date (optional)', '2028-01-01');
    fireEvent.press(screen.getByText('Add'));
    expect(
      screen.getByText('Type the estimate as a dollar amount, like 250 or 249.99.'),
    ).toBeTruthy();
    expect(screen.getByText('Pick a date within one year from today.')).toBeTruthy();

    type('Preferred date (optional)', '11/20/2026');
    fireEvent.press(screen.getByText('Add'));
    expect(screen.getByText('Use the format YYYY-MM-DD, like 2026-11-20.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('typing clears only that field, and the summary goes once nothing is wrong', () => {
    renderForm();
    fireEvent.press(screen.getByText('Add'));
    type('Title', 'P');
    expect(screen.queryByText('Add a title, like Kitchen faucet leaking.')).toBeNull();
    expect(screen.getByText('Describe the problem so it can get fixed.')).toBeTruthy();
    expect(screen.getByText("Add the tenant's name.")).toBeTruthy();
    expect(screen.getByText(invalid_summary)).toBeTruthy();

    type('Tenant name', 'Sam');
    type('Property', 'Maple');
    type('Description', 'x');
    fireEvent.press(screen.getByLabelText('Low priority'));
    expect(screen.queryByText(invalid_summary)).toBeNull();
  });

  test('a valid submit calls onSubmit once with clean data, money as whole cents', () => {
    const { onSubmit } = renderForm();
    fillValid();
    type('Contractor (optional)', ' Wasatch Electric ');
    type('Estimated cost (optional)', '45.5');
    type('Preferred date (optional)', '2026-11-20');
    fireEvent.press(screen.getByText('Add'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'Porch light out',
      description: 'The bulb by the front door went out last night.',
      priority: 'Normal',
      contractor: 'Wasatch Electric',
      estimate_cents: 4550,
      preferred_date: '2026-11-20',
      tenant: 'Sam Rivera',
      property: '123 Maple St, Unit 2',
      photo_changed: false,
    });
    expect(screen.queryByText(invalid_summary)).toBeNull();
  });

  test('a blank estimate goes through as null', () => {
    const { onSubmit } = renderForm();
    fillValid();
    fireEvent.press(screen.getByText('Add'));
    expect(onSubmit.mock.calls[0][0].estimate_cents).toBeNull();
  });

  test('Cancel calls onCancel', () => {
    const { onCancel } = renderForm();
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('create and edit', () => {
  const order = {
    id: '9',
    title: 'Garage door stuck',
    description: 'It stops halfway up and backs down.',
    priority: 'Emergency',
    contractor: 'Door Pros',
    estimate: 180.5,
    preferred_date: '2026-11-10',
    tenant: 'Sam Rivera',
    property: '123 Maple St, Unit 2',
    status: 'Open',
  };

  test('create starts empty and says Add', () => {
    renderForm();
    expect(screen.getByText('Add')).toBeTruthy();
    expect(screen.getByLabelText('Title').props.value).toBe('');
    expect(screen.getByLabelText('Emergency priority').props.accessibilityState.selected).toBe(
      false,
    );
  });

  test('edit fills in every field from the order and says Update', () => {
    const { onSubmit } = renderForm({
      submitButtonLabel: 'Update',
      defaultValues: order,
      isEditing: true,
    });
    expect(screen.getByText('Update')).toBeTruthy();
    expect(screen.queryByText('Add')).toBeNull();
    expect(screen.getByLabelText('Title').props.value).toBe('Garage door stuck');
    expect(screen.getByLabelText('Description').props.value).toBe(
      'It stops halfway up and backs down.',
    );
    expect(screen.getByLabelText('Contractor (optional)').props.value).toBe('Door Pros');
    expect(screen.getByLabelText('Estimated cost (optional)').props.value).toBe('180.50');
    expect(screen.getByLabelText('Preferred date (optional)').props.value).toBe('2026-11-10');
    expect(screen.getByLabelText('Tenant name').props.value).toBe('Sam Rivera');
    expect(screen.getByLabelText('Emergency priority').props.accessibilityState.selected).toBe(
      true,
    );
    // an edit can keep a date that has already gone by
    type('Preferred date (optional)', '2026-10-01');
    fireEvent.press(screen.getByText('Update'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].estimate_cents).toBe(18050);
  });

  test('a real-mode edit shows the title and description read only and skips their rules', () => {
    const { onSubmit } = renderForm({
      submitButtonLabel: 'Update',
      defaultValues: { ...order, description: '' },
      isEditing: true,
      variant: 'remote_owner',
      showDate: false,
      readOnlyText: true,
      placeText: '123 Maple St, Unit 2',
    });
    expect(screen.getByLabelText('Title').props.editable).toBe(false);
    expect(screen.getByLabelText('Description').props.editable).toBe(false);
    expect(screen.queryByLabelText('Preferred date (optional)')).toBeNull();
    expect(
      screen.getByText("The location can't change after the work order is created."),
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Update'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('the description counter', () => {
  test('counts as you type and turns amber at 90 percent', () => {
    renderForm();
    const counter = () => screen.getByTestId('input-counter');
    expect(counter().props.children).toBe('0/500');
    type('Description', 'a'.repeat(42));
    expect(counter().props.children).toBe('42/500');
    expect(counter().props.accessibilityLabel).toBe('42 of 500 characters used');
    expect(colorOf(counter())).toBe(LIGHT_COLORS.text_muted);
    expect(hintOf('Description')).toBe('42 of 500 characters used');
    type('Description', 'a'.repeat(450));
    expect(counter().props.children).toBe('450/500');
    expect(colorOf(counter())).toBe(LIGHT_COLORS.warning_text);
    expect(screen.getByLabelText('Description').props.maxLength).toBe(500);
    expect(screen.getByLabelText('Description').props.multiline).toBe(true);
  });
});

describe('the date', () => {
  test('the calendar button opens the picker and the picked day fills the same box', () => {
    renderForm();
    expect(screen.queryByTestId('ios-date-picker')).toBeNull();
    fireEvent.press(screen.getByTestId('date-picker-button'));
    expect(screen.getByTestId('ios-date-picker')).toBeTruthy();
    // creating can't go before today, so the picker's minimum is the 4th
    expect(screen.getByText('min 4')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mock-native-picker'));
    expect(screen.getByLabelText('Preferred date (optional)').props.value).toBe('2026-11-20');
    fireEvent.press(screen.getByLabelText('Close the calendar'));
    expect(screen.queryByTestId('ios-date-picker')).toBeNull();
  });

  test('typing the date works the same way and goes through the same rules', () => {
    const { onSubmit } = renderForm();
    fillValid();
    type('Preferred date (optional)', '2026-12-01');
    fireEvent.press(screen.getByText('Add'));
    expect(onSubmit.mock.calls[0][0].preferred_date).toBe('2026-12-01');
    expect(screen.getByLabelText('Preferred date (optional)').props.maxLength).toBe(10);
    expect(screen.getByLabelText('Preferred date (optional)').props.placeholder).toBe('YYYY-MM-DD');
  });
});

describe('the keyboard', () => {
  test('return says next and moves down, the last box says done, multiline keeps its return', () => {
    renderForm();
    expect(screen.getByLabelText('Tenant name').props.returnKeyType).toBe('next');
    expect(screen.getByLabelText('Title').props.returnKeyType).toBe('next');
    expect(screen.getByLabelText('Estimated cost (optional)').props.keyboardType).toBe(
      'decimal-pad',
    );
    expect(screen.getByLabelText('Preferred date (optional)').props.returnKeyType).toBe('done');
    expect(screen.getByLabelText('Description').props.onSubmitEditing).toBeUndefined();

    fireEvent(screen.getByLabelText('Tenant name'), 'submitEditing');
    expect(TextInput.prototype.focus.mock.contexts.at(-1).props.accessibilityLabel).toBe(
      'Property',
    );
    fireEvent(screen.getByLabelText('Title'), 'submitEditing');
    expect(TextInput.prototype.focus.mock.contexts.at(-1).props.accessibilityLabel).toBe(
      'Description',
    );
    fireEvent(screen.getByLabelText('Contractor (optional)'), 'submitEditing');
    expect(TextInput.prototype.focus.mock.contexts.at(-1).props.accessibilityLabel).toBe(
      'Estimated cost (optional)',
    );
  });
});

describe('the dirty flag for the discard prompt', () => {
  test('starts clean, turns on with a change, and goes back off when the change is undone', () => {
    const { onDirtyChange } = renderForm();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    type('Title', 'Porch');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    type('Title', '');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  test('an edit that only shows its saved values is clean', () => {
    const { onDirtyChange } = renderForm({
      defaultValues: { title: 'Garage door stuck', priority: 'Low', estimate: null },
      isEditing: true,
    });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    fireEvent.press(screen.getByLabelText('Normal priority'));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });
});

describe('both themes', () => {
  test.each([
    ['light', LIGHT_COLORS],
    ['dark', DARK_COLORS],
  ])('the errors and labels draw in the %s palette', (scheme, palette) => {
    act(() => setActiveScheme(scheme));
    renderForm();
    fireEvent.press(screen.getByText('Add'));
    expect(colorOf(screen.getByText('Add a title, like Kitchen faucet leaking.'))).toBe(
      palette.danger_text,
    );
    expect(colorOf(screen.getByText(invalid_summary))).toBe(palette.danger_text);
    expect(colorOf(screen.getByText('Contractor (optional)'))).toBe(palette.text_muted);
  });
});
