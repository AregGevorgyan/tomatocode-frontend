// this is sample code needs to change

import React, { useState, useEffect } from 'react';
import MonacoEditor from '../common/MonacoEditor';
import Terminal from '../common/Terminal';
import RunButton from '../common/RunButton';
import StatusLegend from '../common/StatusLegend';
import PromptContainer from './PromptContainer';
import FeedbackContainer from './FeedbackContainer';
import { useFeedback } from '../../hooks/useFeedback';
import { useCodeExecution } from '../../hooks/useCodeExecution';
import { useEditorContext } from '../../contexts/EditorContext';
import '../../styles/student.css';

const StudentView = () => {
  const [prompt, setPrompt] = useState('Write a JavaScript function called `add` that takes two numbers and returns their sum.');
  const [terminalOutput, setTerminalOutput] = useState([{ type: 'info', text: 'Terminal ready.' }]);
  
  const { editor } = useEditorContext();
  const { feedback, feedbackStatus, isLoading } = useFeedback(prompt, editor);
  const { executeCode, clearTerminal } = useCodeExecution(setTerminalOutput);
  
  const handleRunCode = () => {
    if (!editor) return;
    clearTerminal();
    executeCode(editor.getValue());
  };

  const handlePromptChange = (newPrompt) => {
    setPrompt(newPrompt);
  };

  return (
    <div className="student-view">
      {/* Decorative Images */}
      <div className="tomato-corner top-left">
        <img src="/assets/images/tomato-decoration.png" alt="Tomato decoration" />
      </div>
      <div className="tomato-corner bottom-right">
        <img src="/assets/images/tomato-decoration.png" alt="Tomato decoration" />
      </div>

      {/* Status Legend */}
      <StatusLegend />

      {/* Main Content Panel */}
      <div id="right-panel">
        <PromptContainer 
          prompt={prompt} 
          onPromptChange={handlePromptChange} 
        />
        
        <MonacoEditor />
        
        <FeedbackContainer 
          status={feedbackStatus} 
          text={feedback} 
          isLoading={isLoading} 
        />
        
        <div id="runContainer">
          <RunButton onClick={handleRunCode} />
        </div>
        
        <Terminal output={terminalOutput} />
      </div>
    </div>
  );
};

export default StudentView;