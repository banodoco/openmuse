
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Function to render the app with proper error handling
const renderApp = () => {
  try {
    const rootElement = document.getElementById("root");
    
    if (!rootElement) {
      console.error("Failed to find the root element. Make sure there's a div with id='root' in index.html");
      document.body.innerHTML = '<div style="color: red; padding: 20px; font-family: sans-serif;"><h1>Error Loading Application</h1><p>Could not find root element. Please check the console for more details.</p></div>';
      return;
    }
    
    createRoot(rootElement).render(<App />);
    console.log("Application successfully rendered");
  } catch (error) {
    console.error("Failed to render the application:", error);
    document.body.innerHTML = '<div style="color: red; padding: 20px; font-family: sans-serif;"><h1>Error Loading Application</h1><p>An error occurred while loading the application. Please check the console for more details.</p></div>';
  }
};

// Initialize the application
renderApp();
