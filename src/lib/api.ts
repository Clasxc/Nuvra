
// API utility functions for SAT Genius

// Base URL for API endpoints
const API_BASE_URL = 'http://localhost:8000'; // Change this to your actual API URL

// Function to ask a question to the AI
export async function askQuestion(question: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error asking question:', error);
    throw error;
  }
}

// Function to upload a document
export async function uploadDocument(file: File) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
}
