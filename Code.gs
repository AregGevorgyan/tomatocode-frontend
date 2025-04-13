/**
 * @OnlyCurrentDoc  Limits the script to only accessing the current presentation.
 */

// --- Configuration ---
// !!! REPLACE WITH YOUR ACTUAL URLs !!!
const BACKEND_URL = "https://your-ec2-backend-domain.com/api/sessions/create"; 
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
    const presentation = SlidesApp.getActivePresentation();
    const selection = presentation.getSelection();
    const currentPage = selection.getCurrentPage();

    // Ensure something is selected and it's a slide
    if (!currentPage || currentPage.getPageType() !== SlidesApp.PageType.SLIDE) {
       throw new Error("Please select a slide first.");
    }
    
    const slide = currentPage.asSlide(); // Cast Page to Slide
    const notesPage = slide.getNotesPage();

    if (!notesPage) {
       // This is unlikely for a normal slide, but good to check.
       throw new Error("Could not access the speaker notes page for this slide.");
    }
    
    // *** FIX: Get the shape from the notesPage, not the slide ***
    const speakerNotesShape = notesPage.getSpeakerNotesShape(); 

    if (!speakerNotesShape) {
      // If no speaker notes shape exists yet, insert the text which often creates it.
      // Note: slide.insertSpeakerNotes() is deprecated, use notesPage methods if possible,
      // but modifying the shape directly is preferred. Let's try creating text if shape is null.
       notesPage.getPlaceholder(SlidesApp.PlaceholderType.BODY) // Often the notes placeholder
                .asShape().getText().setText(CODING_SLIDE_MARKER + "\nPrompt: [Enter your question prompt here]");
       Logger.log("Inserted marker into notes placeholder as shape didn't exist.");

    } else {
      const notes = speakerNotesShape.getText().asString();
      // Avoid adding duplicate markers
      if (!notes.includes(CODING_SLIDE_MARKER)) {
         // Prepend the marker to existing notes
         speakerNotesShape.getText().insertText(0, CODING_SLIDE_MARKER + "\nPrompt: [Enter your question prompt here]\n\n");
         Logger.log("Prepended marker to existing speaker notes.");
      } else {
         // Optional: Notify user it's already marked
         SlidesApp.getUi().alert("This slide is already marked as a coding question.");
         return; // Don't show the success alert below if already marked.
      }
    }
    
     SlidesApp.getUi().alert("Coding question marker added to speaker notes. Edit the notes to add your specific prompt.");

  } catch (error) {
    Logger.log("Error adding marker: " + error + "\nStack: " + error.stack); // Log stack trace
    SlidesApp.getUi().alert("Error: Could not add coding question marker. " + error.message);
    // Re-throw for failure handler in dialog
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
    const presentationId = presentation.getId(); // Get the presentation ID
    const slides = presentation.getSlides();
    
    // Construct the embed URL (adjust parameters as needed)
    // IMPORTANT: The presentation MUST be published to the web for this embed URL to work without login.
    // File -> Share -> Publish to web -> Embed tab -> Publish. 
    // Or ensure link sharing allows anyone with the link to view.
    // A simpler embed URL often works if published:
    const embedUrl = `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=60000`; 
    // Alternative using the published link structure (might require extracting the pub URL if already published)
    // const pubUrl = `https://docs.google.com/presentation/d/e/YOUR_PUBLISHED_ID/embed?start=false&loop=false&delayms=3000`;


    Logger.log(`Presentation ID: ${presentationId}`);
    Logger.log(`Generated Embed URL: ${embedUrl}`);

    const slideData = slides.map((slide, index) => {
      let hasCodingTask = false;
      let prompt = "[No Prompt Specified]"; // Default prompt
      let title = `Slide ${index + 1}`; 

      try {
          const notesPage = slide.getNotesPage();
          if (notesPage) {
              const speakerNotesShape = notesPage.getSpeakerNotesShape();
              if (speakerNotesShape) {
                  const notes = speakerNotesShape.getText().asString();
                  if (notes.includes(CODING_SLIDE_MARKER)) {
                      hasCodingTask = true;
                      // Improved prompt extraction (case-insensitive, multiline)
                      const promptMatch = notes.match(/\[PEARCODE_QUESTION\]\s*Prompt:\s*([\s\S]*)/i);
                      if (promptMatch && promptMatch[1]) {
                          prompt = promptMatch[1].trim();
                      } else {
                          // Fallback if marker exists but prompt format is wrong
                          prompt = "[Prompt Format Error in Notes]"; 
                      }
                  }
              }
          }

          // Try to get a title from the slide (might be empty)
          // Use page elements instead of shapes for potentially better title identification
          const pageElements = slide.getPageElements();
          for (let i = 0; i < pageElements.length; i++) {
              if (pageElements[i].getPageElementType() === SlidesApp.PageElementType.SHAPE) {
                  const shape = pageElements[i].asShape();
                  if (shape.getText && shape.getText().asString().trim().length > 0) {
                      // Heuristic: Assume the first non-empty shape is the title
                      title = shape.getText().asString().trim().substring(0, 80); // Limit length
                      break; 
                  }
              }
          }
      } catch (slideError) {
           Logger.log(`Error processing slide ${index}: ${slideError}`);
           // Use defaults if an error occurs processing a single slide
      }

      return {
        index: index,
        title: title, 
        hasCodingTask: hasCodingTask,
        prompt: prompt 
      };
    });

    // Prepare payload for the backend
    const payload = {
      title: presentationTitle || 'Untitled Presentation',
      description: `Coding session for ${presentationTitle}`,
      language: 'javascript', // Default language
      initialCode: '// Start your code here!\n', // Default initial code
      slides: slideData, // Send the structured slide info
      presentationId: presentationId, // Send the ID
      embedUrl: embedUrl // Send the constructed embed URL
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true // Prevent script termination on HTTP errors, handle manually
    };

    Logger.log("Sending session creation request to: " + BACKEND_URL);
    // Logger.log("Payload: " + JSON.stringify(payload)); // Log payload only if needed for debugging sensitive data

    const response = UrlFetchApp.fetch(BACKEND_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    Logger.log("Backend Response Code: " + responseCode);
    // Logger.log("Backend Response Body: " + responseBody); // Log response body carefully

    if (responseCode === 201) {
      const jsonResponse = JSON.parse(responseBody);
      if (jsonResponse.success && jsonResponse.sessionCode) {
        const teacherUrl = TEACHER_VIEW_BASE_URL + jsonResponse.sessionCode;
        Logger.log("Session created successfully. Teacher URL: " + teacherUrl);
        return teacherUrl; // Return URL to sidebar JS
      } else {
        throw new Error("Backend response format error. Missing success flag or session code. Response: " + responseBody);
      }
    } else {
      // Handle backend errors more informatively
       let errorMessage = `Backend communication error (Code: ${responseCode}).`;
       try {
         const errorJson = JSON.parse(responseBody);
         // Append backend's message if available
         if(errorJson.message) {
             errorMessage += ` Server message: ${errorJson.message}`;
         } else {
             errorMessage += ` Response: ${responseBody}`;
         }
       } catch(e) {
         // If response is not JSON
         errorMessage += ` Raw Response: ${responseBody}`;
       }
      Logger.log("Backend error details: " + errorMessage);
      throw new Error(errorMessage);
    }

  } catch (error) {
    Logger.log("Error initiating lesson session: " + error + "\nStack: " + error.stack);
    // Provide a user-friendly message but log the technical details
    throw new Error("Failed to start lesson session. Please check logs or contact support. Error: " + error.message); 
  }
}
