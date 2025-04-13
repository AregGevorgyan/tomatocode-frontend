/**
 * @OnlyCurrentDoc  Limits the script to only accessing the current presentation.
 */

// --- Configuration ---
// Replace with your actual backend URL
const BACKEND_URL = "https://your-ec2-backend-domain.com/api/sessions/create"; 
// Replace with your actual frontend teacher view URL base
const TEACHER_VIEW_BASE_URL = "https://tomatocode.xyz/teacher/"; 
// Marker text to identify coding question slides in speaker notes
const CODING_SLIDE_MARKER = "[PEARCODE_QUESTION]"; 

// --- Google Slides Add-on Lifecycle Functions ---

/**
 * Runs when the add-on is installed or the document is opened.
 * Creates the add-on menu.
 * @param {object} e The event object.
 */
function onOpen(e) {
  SlidesApp.getUi()
      .createAddonMenu()
      .addItem('Open PearCode Controls', 'openSidebar')
      .addToUi();
}

/**
 * Runs when the add-on is installed.
 * @param {object} e The event object.
 */
function onInstall(e) {
  onOpen(e);
}

// --- Sidebar and Dialog Functions ---

/**
 * Opens the sidebar interface.
 */
function openSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
      .setTitle('PearCode Controls');
  SlidesApp.getUi().showSidebar(html);
}

/**
 * Opens a confirmation dialog for adding a coding question marker.
 */
function openEmptyQuestionDialog() {
  const html = HtmlService.createHtmlOutputFromFile('QuestionDialog')
      .setWidth(350)
      .setHeight(150);
  SlidesApp.getUi().showModalDialog(html, 'Add Code Question Marker');
}

// --- Core Logic Functions ---

/**
 * Adds a marker to the speaker notes of the current slide
 * indicating it's a coding question slide. Called from QuestionDialog.html.
 */
function addInteractiveSlideMarker() {
  try {
    const slide = SlidesApp.getActivePresentation().getSelection().getCurrentPage();
    if (!slide) {
      throw new Error("No slide selected.");
    }

    const speakerNotesShape = slide.getSpeakerNotesShape();
    if (!speakerNotesShape) {
      // If no speaker notes shape exists, we might need to create one or handle this case.
      // For simplicity, we'll just add the text. Slides usually creates one if needed.
      slide.insertSpeakerNotes(CODING_SLIDE_MARKER + "\nPrompt: [Enter your question prompt here]");
    } else {
      const notes = speakerNotesShape.getText().asString();
      // Avoid adding duplicate markers
      if (!notes.includes(CODING_SLIDE_MARKER)) {
         speakerNotesShape.getText().insertText(0, CODING_SLIDE_MARKER + "\nPrompt: [Enter your question prompt here]\n");
      } else {
         // Optional: Notify user it's already marked
         SlidesApp.getUi().alert("This slide is already marked as a coding question.");
      }
    }
     SlidesApp.getUi().alert("Coding question marker added to speaker notes. Edit the notes to add your specific prompt.");

  } catch (error) {
    Logger.log("Error adding marker: " + error);
    SlidesApp.getUi().alert("Error: Could not add coding question marker. " + error.message);
    // Re-throw for failure handler in dialog if needed, though alert is usually sufficient
    throw error; 
  }
}

/**
 * Gathers presentation data, calls the backend to create a session,
 * and returns the URL for the teacher view. Called from Sidebar.html.
 * @returns {string} The URL for the teacher view (e.g., https://tomatocode.xyz/teacher/abcdef)
 * @throws {Error} If session creation fails.
 */
function initiateLessonSession() {
  try {
    const presentation = SlidesApp.getActivePresentation();
    const presentationTitle = presentation.getName();
    const slides = presentation.getSlides();
    
    const slideData = slides.map((slide, index) => {
      let hasCodingTask = false;
      let prompt = null;
      const speakerNotesShape = slide.getSpeakerNotesShape();
      
      if (speakerNotesShape) {
        const notes = speakerNotesShape.getText().asString();
        if (notes.includes(CODING_SLIDE_MARKER)) {
          hasCodingTask = true;
          // Basic prompt extraction (assumes "Prompt:" follows the marker)
          const promptMatch = notes.match(/Prompt:(.*)/i);
          if (promptMatch && promptMatch[1]) {
            prompt = promptMatch[1].trim();
          } else {
            prompt = "[Prompt not specified in notes]"; // Default if format is wrong
          }
        }
      }
      
      // Try to get a title from the slide (might be empty)
      let title = `Slide ${index + 1}`; 
      const titleShapes = slide.getShapes().filter(s => s.getText().find(/^.+$/)); // Find shapes with text
      if (titleShapes.length > 0) {
         // Heuristic: assume the first shape with text is the title
         title = titleShapes[0].getText().asString().trim().substring(0, 50); // Limit length
      }

      return {
        index: index,
        title: title, // Use slide index or extracted title
        hasCodingTask: hasCodingTask,
        prompt: prompt 
      };
    });

    // Prepare payload for the backend
    const payload = {
      title: presentationTitle || 'Untitled Presentation',
      description: `Coding session for ${presentationTitle}`,
      language: 'javascript', // Or make this configurable? Defaulting for now.
      initialCode: '// Start coding here!', // Default initial code
      slides: slideData // Send the structured slide info
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true // Prevent script termination on HTTP errors, handle manually
    };

    Logger.log("Sending session creation request to: " + BACKEND_URL);
    Logger.log("Payload: " + JSON.stringify(payload));

    const response = UrlFetchApp.fetch(BACKEND_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    Logger.log("Backend Response Code: " + responseCode);
    Logger.log("Backend Response Body: " + responseBody);

    if (responseCode === 201) {
      const jsonResponse = JSON.parse(responseBody);
      if (jsonResponse.success && jsonResponse.sessionCode) {
        const teacherUrl = TEACHER_VIEW_BASE_URL + jsonResponse.sessionCode;
        Logger.log("Session created. Teacher URL: " + teacherUrl);
        return teacherUrl; // Return URL to sidebar JS
      } else {
        throw new Error("Backend response missing success flag or session code. Response: " + responseBody);
      }
    } else {
      // Handle backend errors
       let errorMessage = `Backend error (${responseCode}).`;
       try {
         const errorJson = JSON.parse(responseBody);
         errorMessage += ` Message: ${errorJson.message || responseBody}`;
       } catch(e) {
         errorMessage += ` Response: ${responseBody}`;
       }
      throw new Error(errorMessage);
    }

  } catch (error) {
    Logger.log("Error initiating lesson session: " + error);
    // Re-throw the error so the failure handler in Sidebar.html can catch it
    throw new Error("Failed to start lesson: " + error.message); 
  }
}
