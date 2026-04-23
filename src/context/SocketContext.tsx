import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { initSocket, socket } from '../utils/socket';
import { registerFCMToken } from '../utils/notification';

interface SocketContextType {
  socket: typeof socket;
}

const SocketContext = createContext<SocketContextType>({ socket });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { token, isAuthenticated } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (isAuthenticated && token) {
      // Initialize socket connection
      initSocket(token);

      // Register FCM token for push notifications
      registerFCMToken();
    }

    return () => {
      if (socket.connected) socket.disconnect();
    };
  }, [isAuthenticated, token]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};