import { createContext } from 'react';

// null outside real mode, so useWorkOrders() falls back to the local data
// it lives in its own file so the local context and the remote provider can both import it without a loop
export const RemoteWorkOrdersContext = createContext(null);
