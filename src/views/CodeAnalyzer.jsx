import './CodeAnalyzer.css';

import React, { useState, useEffect } from 'react'; // Added useEffect for initialization check

const { GoogleGenerativeAI } = require("@google/generative-ai"); // Or use ES6 import


// --- PLACEHOLDER FOR API KEY ---
const apiKey = "REPLACE GEMINI CODE"; // <-- ⚠️ REPLACE THIS SAFELY!

// Define function schema for AI model (remains the same)
const functionSchema = {
  name: "analyzeCodeResults",
  description: "Classifies code errors and verifies prompt compliance",
  parameters: {
    type: "object",
    properties: {
      progress: {
        type: "string",
        description: "Classifies code as: notStarted, justStarted, halfwayDone, almostDone, allDone"
      },
      feedback: {
        type: "string",
        description: "Instructions: You will give a short blurb (20-30 words), summarizing the general progress of the code. "
        + "Make note of any issues in what has been coded, but do not elaborate on the specifics unless it can be done concisely."
        + "If the last line appears to be incomplete, disregard it in analysis."
      }
    },
    required: ["progress", "feedback"]
  }
};

// Initialize the AI Client (outside component to avoid re-initialization on re-renders)
let genAI = null; // Use let to allow assignment
let initializationError = null; // Track initialization error

if (apiKey && apiKey !== "YOUR_GEMINI_API_KEY_HERE") {
  try {
      genAI = new GoogleGenerativeAI(apiKey);
  } catch (error) {
      console.error("Failed to initialize GoogleGenerativeAI:", error);
      initializationError = "Failed to initialize AI Client. Check console logs and API Key.";
      genAI = null; // Ensure it's null on failure
  }
} else {
    initializationError = "API Key is not configured. Please set it up correctly.";
}


// Helper function for default response
function defaultResponse() {
  return {
    progress: "notStarted",
    feedback: "Analysis could not be performed or prompt/code is empty.",
  };
}

// Helper function to introduce delays
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- React Component ---
function CodeAnalyzer() {
  const [prompt, setPrompt] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(initializationError); // Set initial error if any

  // Effect to clear initialization error if component mounts successfully later
  useEffect(() => {
      if (genAI && error === initializationError) {
          setError(null); // Clear initialization error if AI is now ready
      }
  }, [error]); // Re-run if error changes


  async function analyzeStudentCodeInternal(currentPrompt, currentStudentCode) {
    if (!genAI) {
        setError(initializationError || "AI Client not available."); // Use specific init error
        setIsLoading(false);
        return defaultResponse();
    }
     if (!currentPrompt.trim() || !currentStudentCode.trim()) {
        // Don't set a persistent error, just return default for empty input
        // setError("Please provide both a prompt and student code.");
        setIsLoading(false);
        return {
            progress: "notStarted",
            feedback: "Please provide both a prompt and student code to analyze."
        };
    }

    // --- This is the exact same combined prompt structure ---
    const combinedPrompt = `
      Coding Assignment Prompt:
      ${currentPrompt}

      Student Code:
      ${currentStudentCode}

      Classification Rules:
      - notStarted (empty, no code, blank string, etc.)
      - justStarted (minimal code logic, between 1-40% done)
      - halfwayDone (beginning to develop code towards the solution, between 40-70% done)
      - almostDone (almost done, maybe some minor logical errors, between 70-99% done
      - allDone (the code is fully complete and follows the prompt"
    `;
    // --- End of combined prompt structure ---

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash", // Ensure correct model name
        tools: [{ functionDeclarations: [functionSchema] }]
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: combinedPrompt }] }],
      });

      const functionCall = result.response?.candidates?.[0]?.content?.parts?.find(part => part.functionCall)?.functionCall;

      if (!functionCall || functionCall.name !== "analyzeCodeResults") {
        console.error("Invalid or missing function call in AI response:", result.response);
        setError("AI did not return the expected analysis format.");
        return defaultResponse();
      }

      const analysisArgs = functionCall.args;

      if (!analysisArgs || typeof analysisArgs.progress !== 'string' || typeof analysisArgs.feedback !== 'string') {
          console.error("Invalid function call arguments received:", analysisArgs);
          setError("AI returned improperly formatted analysis data.");
          return defaultResponse();
      }

      return analysisArgs;

    } catch (apiError) {
      console.error("API Error Details:", apiError);
      let errorMessage = `API Error: ${apiError.message || 'Unknown error'}`;

      if (apiError.message && apiError.message.includes('429')) {
        console.warn("API quota likely exceeded - retrying after delay");
        errorMessage = "Rate limit hit, retrying..."; // Update UI feedback
        setError(errorMessage);
        await delay(5000); // Consider a longer delay like 31000 for actual 429s
        return analyzeStudentCodeInternal(currentPrompt, currentStudentCode); // Retry
      }

      setError(errorMessage);
      return defaultResponse();
    }
  }

  // Handler for the button click
  const handleEvaluateClick = async () => {
    // No need to check API key here again, handled by initial check and genAI status
    if (!genAI) {
        setError(initializationError || "AI Client not ready.");
        return;
    }
    setIsLoading(true);
    setError(''); // Clear previous operational errors
    setAnalysisResult(null);

    const result = await analyzeStudentCodeInternal(prompt, studentCode);

    setAnalysisResult(result);
    setIsLoading(false);
  };

  // Determine if the button should be disabled
  const isButtonDisabled = isLoading || !prompt.trim() || !studentCode.trim() || !genAI;


  return (
    // Use the main class name for the container
    <div className="code-analyzer">
      <h1>Student Code Analyzer</h1>

      {/* Display configuration or runtime errors */}
      {error && (
          <p className={`code-analyzer-message ${error.includes("API Key") || error.includes("initialize") ? 'warning' : 'error'}`}>
              {error}
          </p>
      )}

      {/* Input section for Prompt */}
      <div className="code-analyzer-input-group">
        <label htmlFor="prompt" className="code-analyzer-label">
          Coding Prompt:
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          className="code-analyzer-textarea code-analyzer-textarea-prompt" // Use CSS classes
          placeholder="Enter the assignment prompt here..."
        />
      </div>

      {/* Input section for Student Code */}
      <div className="code-analyzer-input-group">
        <label htmlFor="studentCode" className="code-analyzer-label">
          Student Code:
        </label>
        <textarea
          id="studentCode"
          value={studentCode}
          onChange={(e) => setStudentCode(e.target.value)}
          rows={15}
          // Apply multiple classes using template literals or simple space separation
          className="code-analyzer-textarea code-analyzer-textarea-code"
          placeholder="Paste student's code here..."
        />
      </div>

      {/* Action Button */}
      <button
        onClick={handleEvaluateClick}
        disabled={isButtonDisabled}
        className="code-analyzer-button" // Use CSS class
      >
        {isLoading ? 'Analyzing...' : 'Evaluate Submission'}
      </button>

      {/* Display Analysis Results */}
      {analysisResult && !error && ( // Only show results if no error is currently displayed
        <div className="code-analyzer-results">
          <h2>Analysis Result:</h2>
          <p><strong>Progress:</strong> {analysisResult.progress}</p>
          <p><strong>Feedback:</strong> {analysisResult.feedback}</p>
        </div>
      )}
    </div>
  );
}

export default CodeAnalyzer;