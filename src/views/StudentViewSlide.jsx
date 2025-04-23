// App.jsx
import './StudentViewSlide.css';
// Make sure React is explicitly imported if not already
import React from 'react';


// Slides Presentation (Wrap with React.memo)
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


// Main App Component
export default function App() {



  return (
    <div className="App">
      <header className="App-header">
        {/* SlidesPresentation will now be memoized */}
        <SlidesPresentation />
      </header>
    </div>
  );
}