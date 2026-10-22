import { createContext } from 'react';

// null unless a real landlord is signed in, so useWorkOrders() keeps the phone's own expenses everywhere else
// it lives in its own file so the local context and the expenses provider can both import it without a loop
export const RemoteExpensesContext = createContext(null);
