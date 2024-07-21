import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SSEContext = createContext();

export const SSEProvider = ({ children }) => {
  const eventSourceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userId = sessionStorage.getItem('userId');
    if (userId) {
      eventSourceRef.current = new EventSource(`${process.env.REACT_APP_API}/events`);

      eventSourceRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('SSE message:', data);
        switch (data.type) {
          case 'RESET_SUCCESS':
            alert(data.payload.message);
            navigate('/login');
            break;
          default:
            console.warn('Unhandled message type:', data.type);
        }
      };

      eventSourceRef.current.onerror = (error) => {
        console.error('SSE error:', error);
        eventSourceRef.current.close();
      };

      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
      };
    }
  }, [navigate]);

  return (
    <SSEContext.Provider value={{ eventSource: eventSourceRef.current }}>
      {children}
    </SSEContext.Provider>
  );
};

export const useSSE = () => useContext(SSEContext);
