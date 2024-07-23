import React, { useState, useEffect } from 'react';
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';

const API_BASE_URL = 'http://localhost:5001'; // APIサーバーのベースURL

const App = () => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if user is already logged in
    const loggedInUser = localStorage.getItem('user');
    if (loggedInUser) {
      setUser(JSON.parse(loggedInUser));
    }
  }, []);

  const handleRegister = async () => {
    try {
      const username = prompt('Enter a username:');
      if (!username) return;

      // API call to server to start registration
      const options = await fetch(
        `${API_BASE_URL}/generate-registration-options`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        }
      ).then((res) => res.json());

      const result = await startRegistration(options);

      // Send result to server for verification
      const verificationResponse = await fetch(
        `${API_BASE_URL}/verify-registration`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, response: result }),
        }
      ).then((res) => res.json());

      if (verificationResponse.verified) {
        setUser({ username });
        localStorage.setItem('user', JSON.stringify({ username }));
      } else {
        setError('Registration failed');
      }
    } catch (error) {
      setError('Registration failed: ' + error.message);
    }
  };

  const handleLogin = async () => {
    try {
      const username = prompt('Enter your username:');
      if (!username) return;

      // API call to server to start authentication
      const options = await fetch(
        `${API_BASE_URL}/generate-authentication-options`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        }
      ).then((res) => res.json());

      const result = await startAuthentication(options);

      // Send result to server for verification
      const verificationResponse = await fetch(
        `${API_BASE_URL}/verify-authentication`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, response: result }),
        }
      ).then((res) => res.json());

      if (verificationResponse.verified) {
        setUser({ username });
        localStorage.setItem('user', JSON.stringify({ username }));
      } else {
        setError('Authentication failed');
      }
    } catch (error) {
      setError('Authentication failed: ' + error.message);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-6 bg-white rounded shadow-md">
        <h1 className="text-2xl font-bold mb-4">Passkey Authentication Demo</h1>
        {user ? (
          <div>
            <p className="mb-4">Welcome, {user.username}!</p>
            <button
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        ) : (
          <div>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-2"
              onClick={handleRegister}
            >
              Register
            </button>
            <button
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              onClick={handleLogin}
            >
              Login
            </button>
          </div>
        )}
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
    </div>
  );
};

export default App;
