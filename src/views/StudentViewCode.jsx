// App.jsx
import './StudentViewCode.css';
// Make sure React is explicitly imported if not already
import React from 'react';
import { useEffect, useRef, useState } from 'react';

// --- Terminal Component (Remains the same) ---
function Terminal({ outputLines }) {
  const terminalEndRef = useRef(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [outputLines]);

  return (
    <div className="terminal-container">
      <pre className="terminal-output">
        {outputLines.map((line) => (
          <div key={line.id} className={`output-line ${line.type || 'log'}`}>
            {line.text}
          </div>
        ))}
        <div ref={terminalEndRef} />
      </pre>
    </div>
  );
}


// --- Slides Presentation (Wrap with React.memo) ---
const SlidesPresentation = React.memo(function SlidesPresentation() {

  const embedGS = `<iframe src="https://docs.google.com/presentation/d/e/2PACX-1vQP6FAykLuz88U3X9kTCvm55G8DGmFHMSsW6eYQcbT38EjHjVcFp-B8yxNNTWj9BjQkQsE-YOkSnHuJ/embed?start=false&loop=false&delayms=3000&rm=minimal"
                          frameborder="0"
                          width="100%"
                          height="100%"
                          style="display: block; border: none;"
                          allowfullscreen="true"
                          mozallowfullscreen="true"
                          webkitallowfullscreen="true">
                  </iframe>`;
  return (
    // Ensure the container div takes full height too
    <div className="slides-container">
       {/* This inner div might be redundant if .slides-container handles sizing */}
      <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: embedGS }} />
    </div>
  );
}); 


// --- Code Editor Component (Remains the same) ---
function CodeEditor({ code, onCodeChange }) {
  // ... (keep existing code) ...
   const editorRef = useRef(null);
  const [editorInstance, setEditorInstance] = useState(null);
  const [editorLoaded, setEditorLoaded] = useState(false);
  const isUpdatingFromProp = useRef(false);

  useEffect(() => {
    if (!window.require) {
      const loader = document.createElement('script');
      loader.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs/loader.js';
      loader.async = true;
      loader.onload = () => {
        window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs' }});
        window.require(['vs/editor/editor.main'], () => {
          setEditorLoaded(true);
        });
      };
      document.body.appendChild(loader);
      return () => {
        if (loader && document.body.contains(loader)) {
          document.body.removeChild(loader);
        }
      };
    } else {
       if (!window.monaco) {
         window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs' }});
         window.require(['vs/editor/editor.main'], () => {
           setEditorLoaded(true);
         });
      } else {
          setEditorLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    let editor; // Define editor variable here
    if (editorLoaded && editorRef.current && !editorInstance) {
      editor = window.monaco.editor.create(editorRef.current, { // Assign to editor
        value: code,
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        selectOnLineNumbers: true,
        roundedSelection: false,
        readOnly: false,
        cursorStyle: 'line',
        fontSize: 14
      });

      editor.onDidChangeModelContent(() => {
         if (!isUpdatingFromProp.current) {
             onCodeChange(editor.getValue());
         }
      });

      setEditorInstance(editor); // Set instance state
    }

    // Cleanup function
    return () => {
      // Use the editor variable captured in the outer scope
      if (editor) {
        editor.dispose();
        setEditorInstance(null); // Also clear state on cleanup
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorLoaded]); // Dependencies: only editorLoaded triggers creation


  useEffect(() => {
      if (editorInstance && code !== editorInstance.getValue()) {
          isUpdatingFromProp.current = true;
          editorInstance.setValue(code);
          isUpdatingFromProp.current = false;
      }
  }, [code, editorInstance]);


  return (
    <div
      ref={editorRef}
      className="code-editor-container"
    />
  );
}


// --- Main App Component (Remains the same) ---
export default function App() {
  // ... (keep existing state and functions: code, terminalOutput, addTerminalMessage, clearTerminal, handleRunCode) ...
  const [code, setCode] = useState('// Start typing your code here...\nconsole.log("Hello from Editor!");\n\nfunction greet(name) {\n  return "Hi, " + name + "!";\n}\ngreet("Developer");');
  const [terminalOutput, setTerminalOutput] = useState([{ id: 0, text: 'Terminal ready. Click "Run" to execute code.', type: 'info' }]);
  const outputIdCounter = useRef(1);

  const addTerminalMessage = (text, type = 'log') => {
    setTerminalOutput(prev => [
        ...prev,
        { id: outputIdCounter.current++, text, type }
    ]);
  };

  const clearTerminal = () => {
    setTerminalOutput([]);
    outputIdCounter.current = 1;
  };

  const handleRunCode = () => {
    clearTerminal();
    addTerminalMessage(`> Running code...`, 'info');

    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.log = (...args) => {
      addTerminalMessage(args.map(String).join(' '), 'log');
      originalConsoleLog.apply(console, args);
    };
    console.error = (...args) => {
      addTerminalMessage(args.map(String).join(' '), 'error');
      originalConsoleError.apply(console, args);
    };
    console.warn = (...args) => {
      addTerminalMessage(args.map(String).join(' '), 'warn');
      originalConsoleWarn.apply(console, args);
    };

    try {
      // eslint-disable-next-line no-new-func
      const executeCode = new Function('"use strict";' + code);
      const result = executeCode();

      if (result !== undefined) {
         addTerminalMessage(`> Return value: ${String(result)}`, 'info');
      }

      addTerminalMessage('Code executed successfully.', 'success');

    } catch (error) {
      addTerminalMessage(`Error: ${error.message}`, 'error');
      originalConsoleError("Execution Error:", error);
    } finally {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    }
  };


  return (
    <div className="App">
      <header className="App-header">
        {/* SlidesPresentation will now be memoized */}
        <SlidesPresentation />
        <div className="right-side">
          <CodeEditor code={code} onCodeChange={setCode} />
          <button onClick={handleRunCode} className="run-button">
             Run Code
          </button>
          <Terminal outputLines={terminalOutput} />
        </div>
      </header>
    </div>
  );
}