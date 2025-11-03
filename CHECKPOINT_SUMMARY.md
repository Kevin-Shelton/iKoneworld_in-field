# iK OneWorld In-Field Translation App - Checkpoint Summary

**Date:** November 3, 2025
**Author:** Manus AI

## 1. Application Architecture

The iK OneWorld application is a modern, full-stack web application built on Next.js, designed for real-time, in-person language translation. It leverages a robust stack to provide a seamless and enterprise-ready experience.

### Core Technologies

The application is built with the following primary technologies:

| Category         | Technology                                       | Description                                                                                             |
|------------------|--------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| **Framework**    | [Next.js](https://nextjs.org/) (v16, App Router) | A React framework for building server-rendered and statically generated web applications.                     |
| **Authentication** | [Supabase Auth](https://supabase.com/auth)      | Handles user login, registration, and session management, integrating seamlessly with the Next.js backend. |
| **Database**     | [Supabase (PostgreSQL)](https://supabase.com/database) | A managed PostgreSQL database for storing all application data.                                           |
| **ORM**          | [Drizzle ORM](https://orm.drizzle.team/)         | A TypeScript ORM used for database schema definition, migrations, and type-safe database queries.         |
| **Styling**      | [Tailwind CSS](https://tailwindcss.com/)         | A utility-first CSS framework for rapid UI development.                                                   |
| **UI Components**  | [shadcn/ui](https://ui.shadcn.com/)              | A collection of beautifully designed, accessible, and reusable components built on Radix UI and Tailwind. |
| **Deployment**   | [Vercel](https://vercel.com/)                    | The platform for deploying, hosting, and scaling the Next.js application.                                 |

### Project Structure

The project follows a standard Next.js App Router structure, which organizes the application by features and routes.

```plaintext
/home/ubuntu/iKoneworld_in-field
├── app/                      # Main application routes (App Router)
│   ├── (auth)/               # Authentication-related pages (login, signup)
│   ├── (dashboard)/          # Protected dashboard routes
│   │   ├── dashboard/
│   │   ├── profile/
│   │   ├── select-language/
│   │   └── translate/
│   └── api/                  # Server-side API routes
│       ├── conversations/
│       ├── customers/
│       ├── recognize/
│       ├── synthesize/
│       ├── token/
│       ├── translate/
│       └── voices/
├── components/               # Reusable React components (e.g., UI elements)
├── contexts/                 # React contexts (e.g., AuthContext)
├── drizzle/                  # Drizzle ORM schema and migration files
├── lib/                      # Core libraries and utilities
│   ├── db.ts                 # Drizzle database instance
│   └── supabase/             # Supabase client configuration
└── public/                   # Static assets (images, fonts)
```

This architecture provides a clear separation of concerns between the user interface (UI), server-side logic (API routes), and database interactions, making the application scalable and maintainable.

## 2. Verbum AI Integration

The application's core translation capabilities are powered by Verbum AI's suite of services. The integration is sophisticated, using a real-time streaming approach for speech recognition to enable natural, hands-free conversation.

### Services Used

| Service                       | Endpoint                               | Description                                                                                                                               |
|-------------------------------|----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| **Speech-to-Text (STT)**      | `wss://sdk.verbum.ai/listen`           | A WebSocket endpoint for real-time speech recognition. The application streams raw audio data and receives transcription events.          |
| **Translation**               | `https://sdk.verbum.ai/v1/translator/translate` | A REST API for translating text between languages. Used to translate the transcribed text from the STT service.                         |
| **Text-to-Speech (TTS)**      | `https://sdk.verbum.ai/v1/text-to-speech/synthesize` | A REST API for converting text into audible speech. Used to play the translated text aloud for the user or customer.                   |

### Real-Time Speech Recognition Pipeline

The most critical part of the Verbum AI integration is the real-time speech recognition pipeline, which is designed to automatically detect which language is being spoken without requiring user input. This is achieved by streaming the same audio to two separate Verbum AI recognition services simultaneously.

**Audio Processing Flow:**

```mermaid
graph TD
    A[Microphone Audio] --> B{getUserMedia()};
    B --> C[AudioContext (48kHz)];
    C --> D[MediaStreamSource];
    D --> E[Audio Worklet];
    E --> F[Downsample to 8kHz PCM];
    F --> G{Socket.IO Connections};
    G --> H[Verbum AI (Employee Language)];
    G --> I[Verbum AI (Customer Language)];
    H --> J{Winner Selection Algorithm};
    I --> J;
    J --> K[Display & Translate];
```

1.  **Audio Capture**: The browser's `getUserMedia` API captures audio from the microphone.
2.  **Audio Worklet**: A custom `AudioWorklet` processor downsamples the raw 48kHz audio stream into **8kHz 16-bit PCM** format, which is optimal for speech recognition.
3.  **Dual Streaming**: The downsampled audio is streamed in real-time to **two separate WebSocket connections** to Verbum AI's `/listen` endpoint. One connection is configured for the employee's language, and the other for the customer's language.
4.  **Parallel Recognition**: Verbum AI's servers process both audio streams in parallel, attempting to recognize speech in each language.

### Winner Selection Algorithm

Since both recognition services receive the same audio, the application uses a "winner selection" algorithm to determine which transcription is correct:

-   **Pairing Window**: When a recognition event is received from one service, the system waits **1500ms** (the `PAIR_WINDOW_MS`) for a corresponding event from the other service.
-   **Confidence Score**: If two events are paired, the one with the **higher confidence score** is declared the "winner."
-   **Orphan Timeout**: If no matching event arrives within the pairing window, the single event is considered an "orphan" and is processed after a **2500ms** timeout (`ORPHAN_TIMEOUT_MS`).
-   **Confidence Threshold**: All recognition events must have a confidence score of at least **0.1** to be considered valid.

This robust mechanism allows the system to accurately determine who is speaking (employee or customer) based on the language detected, creating a seamless, hands-free conversational experience.

## 3. Application Logic and Workflows

The application follows a logical flow from user authentication to the real-time translation session. This section outlines the key user workflows.

### User Authentication and Profile Setup

1.  **Login/Signup**: Users authenticate using Supabase Auth. New users are automatically synced to the `users` table in the PostgreSQL database.
2.  **Profile Management**: In the `/profile` section, users can set their default language. This preference is stored in the `users` table and is used as the default "employee" language in translation sessions.

### Starting a Translation Session

1.  **Language Selection (`/select-language`)**: Before starting a translation, the employee must select two languages:
    *   **Employee Language**: Defaults to the user's profile setting but can be overridden.
    *   **Customer Language**: The language spoken by the customer.
    These selections are saved to `localStorage` to be used by the translation page.

2.  **Conversation Initialization**: Upon navigating to the `/translate` page:
    *   A new **customer** is created via the `/api/customers` endpoint.
    *   A new **conversation** is created via the `/api/conversations` endpoint, linking the user, customer, and selected languages.
    *   The `conversationId` is stored in the component's state for the duration of the session.

### Real-Time Translation Workflow (`/translate`)

This is the core workflow of the application:

1.  **Start Listening**: The user clicks the "Start Listening" button.
2.  **Audio Pipeline Activation**: This triggers the `startListening` function, which:
    *   Fetches the Verbum AI API key from the `/api/token` endpoint.
    *   Initializes the `AudioContext` and the audio processing pipeline (downsampling worklet).
    *   Opens the two WebSocket connections to Verbum AI for both the employee and customer languages.
    *   Starts streaming the processed audio to both services.
3.  **Automatic Speech Detection**: The user and customer can now speak naturally. The system is always listening.
    *   When speech is detected, both Verbum AI services process it.
    *   The "winner selection algorithm" determines the correct language and transcription.
4.  **Translation and Playback**:
    *   The winning transcription is sent to the Verbum AI **translation** API.
    *   The translated text is then sent to the Verbum AI **Text-to-Speech (TTS)** API.
    *   The returned audio is played aloud.
    *   During TTS playback, the microphone input is temporarily disabled to prevent feedback loops.
5.  **Message Display and Storage**:
    *   The original transcription and its translation are displayed in the appropriate message panel (Employee or Customer).
    *   The message details (original text, translated text, speaker, languages) are saved to the `messages` table in the database, linked to the current `conversationId`.
6.  **End Conversation**: When the "End Conversation" button is clicked:
    *   All WebSocket connections and audio resources are closed.
    *   The conversation is marked as "ended" in the database.
    *   The user is redirected to the dashboard.

## 4. Database Schema and Data Flow

The application uses a PostgreSQL database managed by Supabase, with the schema defined and managed by Drizzle ORM. The database is designed to store user information, language preferences, and detailed records of each translation session.

### Key Database Tables

The following tables are central to the application's data model:

| Table Name               | Description                                                                                                                             |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `users`                  | Stores user profile information, including their unique ID from Supabase Auth, email, name, and default language preference.                |
| `languages`              | A comprehensive list of all supported languages, including their codes, names, and text direction.                                      |
| `stt_languages`          | A list of languages specifically supported by the Verbum AI Speech-to-Text (STT) service.                                                 |
| `conversations`          | Records each translation session, linking a user to the selected languages (`language1`, `language2`) and tracking the session's status. |
| `conversation_messages`  | Stores every message within a conversation, including the original text, translated text, speaker (`user` or `guest`), and confidence score. |
| `user_favorite_languages` | Stores each user's favorite languages for quick access in the language selection screen.                                                |

### Data Flow During a Conversation

1.  **Session Start**: When a user initiates a translation, a new row is created in the `conversations` table, capturing the `userId`, `language1` (employee), and `language2` (customer).
2.  **Message Capture**: As the conversation progresses, each successfully recognized and translated utterance creates a new row in the `conversation_messages` table.
3.  **Data Storage**: This row contains:
    *   `conversationId`: Linking it to the parent session.
    *   `speaker`: Identifying whether the employee (`user`) or customer (`guest`) spoke.
    *   `originalText`: The text transcribed by Verbum AI.
    *   `translatedText`: The text after being processed by the translation API.
    *   `language`: The language code of the `originalText`.
    *   `confidence`: The confidence score (0-100) from the speech recognition service.
4.  **Session End**: When the conversation is ended, the `status` of the corresponding row in the `conversations` table is updated to `completed`, and the `endedAt` timestamp is set.

This data model allows for detailed analytics and billing, as every utterance is recorded with its associated user, languages, and confidence level, providing a complete audit trail of each translation session.

## 5. Current Status: What's Working

As of November 3, 2025, the application is fully functional and operational. The following features have been implemented and tested:

### Core Features

**User Authentication and Management**: Users can sign up, log in, and manage their profiles using Supabase Auth. The system includes role-based access control (user and admin roles) and supports admin-managed user accounts with forced password resets.

**Language Selection**: The application provides a searchable language selector with full language names and native names. Users can select any supported language pair for their translation sessions. The selected languages are stored in `localStorage` and used throughout the session.

**User-Specific Favorites**: Users can mark their frequently-used languages as favorites. These are saved to the database and displayed at the top of the language selection screen for quick access.

**Language Grouping**: Languages are intelligently grouped by their base language (e.g., all Spanish variants together), making it easier to find specific dialects.

**SVG Flag Icons**: The application uses high-quality SVG flag icons from a CDN, ensuring consistent and reliable display across all browsers and operating systems.

**Real-Time Speech Recognition**: The application successfully captures audio from the microphone, downsamples it to 8kHz PCM, and streams it to two Verbum AI WebSocket connections simultaneously. The "winner selection algorithm" accurately determines which language was spoken based on confidence scores and timing windows.

**Automatic Language Detection**: The system automatically detects whether the employee or customer is speaking without requiring manual input. This is achieved by comparing the recognition results from both language-specific Verbum AI services.

**Translation and Text-to-Speech**: Once speech is recognized, the application translates the text using Verbum AI's translation API and then plays the translated text aloud using the Text-to-Speech API. The microphone is temporarily disabled during playback to prevent feedback loops.

**Message Display and Storage**: All messages are displayed in real-time in separate panels for the employee and customer. Each message includes the original text, the translation, a timestamp, and the confidence score. All messages are persisted to the database, linked to the conversation session.

**Reconnection Handling**: If the WebSocket connection to Verbum AI is interrupted, the application automatically attempts to reconnect and displays a "reconnecting" status to the user.

### API Endpoints

The following API endpoints are fully operational:

| Endpoint                 | Method | Description                                                                                      |
|--------------------------|--------|--------------------------------------------------------------------------------------------------|
| `/api/token`             | GET    | Returns the Verbum AI API key for client-side use.                                               |
| `/api/voices`            | GET    | Returns a list of available TTS voices for each language.                                        |
| `/api/translate`         | POST   | Translates text from one language to another using Verbum AI.                                    |
| `/api/synthesize`        | POST   | Converts text to speech using Verbum AI's TTS service.                                           |
| `/api/conversations`     | POST   | Creates a new conversation, saves messages, or ends a conversation.                              |
| `/api/customers`         | POST   | Creates a new customer record (used for tracking).                                               |
| `/api/users/sync`        | POST   | Syncs a Supabase Auth user to the internal `users` table.                                        |
| `/api/languages/user-favorites` | GET, POST, DELETE | Manages user-specific favorite languages.                                                        |

### Language Code Mapping

The application includes a robust language code mapping system to convert the application's detailed language codes (e.g., `en-US`, `es-MX`) to the format expected by Verbum AI (e.g., `en`, `es`). This ensures compatibility across all Verbum AI services (STT, TTS, and translation).

### Known Limitations

While the application is functional, there are a few areas that may require future attention:

**Browser Compatibility**: The application relies on the Web Audio API's `AudioWorklet`, which is only supported in modern browsers like Chrome and Edge. Safari and Firefox may have limited or no support.

**Network Dependency**: The real-time speech recognition requires a stable internet connection. Poor network conditions may result in delayed or failed recognition.

**Language Support**: The application supports any language pair that Verbum AI supports, but the list of available TTS voices is currently hardcoded in the `/api/voices` endpoint. This list may need to be updated as Verbum AI adds new voices.

## 6. Technical Implementation Details

This section provides deeper insights into the technical implementation of the real-time translation feature, which is the most complex part of the application.

### Audio Worklet for PCM Downsampling

The application uses a custom `AudioWorklet` processor to downsample the raw microphone audio from the browser's native sample rate (typically 48kHz) to 8kHz 16-bit PCM, which is the optimal format for speech recognition.

**Worklet Code (Inline):**

```javascript
class DownsampleWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = [];
    this.inRate = sampleRate;
    this.outRate = 8000;
  }
  
  process(inputs) {
    if (inputs[0].length > 0) {
      const ch = inputs[0][0];
      const ratio = this.inRate / this.outRate;
      let off = 0;
      
      while (Math.floor(off) < ch.length) {
        this.buf.push(ch[Math.floor(off)]);
        off += ratio;
      }
      
      while (this.buf.length >= 160) {
        const slice = this.buf.splice(0, 160);
        const ab = new ArrayBuffer(slice.length * 2);
        const v = new DataView(ab);
        
        for (let i = 0; i < slice.length; i++) {
          let s = Math.max(-1, Math.min(1, slice[i]));
          v.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        
        this.port.postMessage(ab);
      }
    }
    return true;
  }
}
registerProcessor('downsample-worklet', DownsampleWorklet);
```

This worklet processes audio in real-time, downsampling it and sending 160-sample chunks (20ms at 8kHz) to the main thread, where they are forwarded to the Verbum AI WebSocket connections.

### Socket.IO Configuration

The application uses the `socket.io-client` library to establish WebSocket connections to Verbum AI's `/listen` endpoint. Each connection is configured with the following parameters:

```typescript
const sock = io('wss://sdk.verbum.ai/listen', {
  path: '/v1/socket.io',
  transports: ['websocket'],
  auth: { token: apiKey },
  query: { language: [lang], encoding: 'PCM', profanityFilter: 'raw' },
  upgrade: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 5000
});
```

The `auth.token` is the Verbum AI API key, and the `query.language` specifies the language for this particular connection. The `encoding: 'PCM'` parameter tells Verbum AI to expect raw PCM audio data.

### Winner Selection Algorithm Implementation

The winner selection algorithm is implemented in the `handleRecognized` function. Here's a simplified version of the logic:

```typescript
const handleRecognized = async (which: 'ws1' | 'ws2', lang: string, data: any) => {
  // ... (validation and confidence filtering)
  
  const now = Date.now();
  const mine: PendingRecognition = { t: now, lang, conf, text: data.text };
  const mineBuf = pendingRef.current[which];
  const otherKey = which === 'ws1' ? 'ws2' : 'ws1';
  const otherBuf = pendingRef.current[otherKey];

  // Look for a mate in the other buffer within the time window
  let mateIdx = -1;
  for (let i = 0; i < otherBuf.length; i++) {
    if (Math.abs(mine.t - otherBuf[i].t) <= PAIR_WINDOW_MS) {
      mateIdx = i;
      break;
    }
  }

  if (mateIdx >= 0) {
    // Found a mate - pick the winner based on confidence
    const mate = otherBuf.splice(mateIdx, 1)[0];
    if (mate && mate.timeoutId) clearTimeout(mate.timeoutId);
    const winner = (mine.conf >= (mate.conf ?? 0)) ? mine : mate;
    await processWinner(winner);
  } else {
    // No mate found - set orphan timeout
    mine.timeoutId = setTimeout(async () => {
      const idx = mineBuf.indexOf(mine);
      if (idx !== -1) {
        mineBuf.splice(idx, 1);
        await processWinner(mine);
      }
    }, ORPHAN_TIMEOUT_MS);
    mineBuf.push(mine);
  }
};
```

This algorithm ensures that even if both services recognize the same audio, only the most confident result is processed, preventing duplicate messages.

### Microphone Track Management

To prevent feedback loops during TTS playback, the application temporarily disables the microphone input by setting the `enabled` property of the audio track to `false`. A reference counter (`micHoldCountRef`) is used to handle cases where multiple TTS operations are queued:

```typescript
// Disable microphone during TTS playback
if (streamRef.current) {
  micHoldCountRef.current++;
  streamRef.current.getTracks().forEach(track => track.enabled = false);
}

// Re-enable after playback finishes
const releaseMic = () => {
  if (streamRef.current) {
    micHoldCountRef.current = Math.max(0, micHoldCountRef.current - 1);
    if (micHoldCountRef.current === 0) {
      streamRef.current.getTracks().forEach(track => track.enabled = true);
    }
  }
};
```

This ensures that the microphone is only re-enabled once all queued TTS operations have completed.

## 7. Conclusion and Future Considerations

The iK OneWorld in-field translation application is a sophisticated, production-ready system that leverages modern web technologies and Verbum AI's powerful language services to provide seamless, real-time translation. The application's architecture is modular, scalable, and maintainable, making it well-suited for enterprise deployment.

### Key Achievements

The application successfully implements a hands-free, automatic language detection system that allows employees and customers to converse naturally in their own languages. The use of a dual WebSocket streaming approach, combined with a confidence-based winner selection algorithm, ensures accurate and reliable speech recognition. All conversation data is persisted to a PostgreSQL database, providing a complete audit trail for analytics and billing purposes.

### Future Enhancements

While the application is fully functional, there are several areas where future development could add value:

**Dynamic Voice Management**: The list of available TTS voices is currently hardcoded. A future enhancement could fetch this list dynamically from Verbum AI or allow administrators to configure voice preferences per language.

**Advanced Analytics Dashboard**: The detailed conversation data stored in the database could be used to build an analytics dashboard, showing metrics such as conversation duration, message counts, language pairs used, and confidence score distributions.

**Multi-Tenant Support**: The database schema includes references to an "enterprise" structure, suggesting that the application was designed with multi-tenancy in mind. Future work could fully implement this feature, allowing multiple organizations to use the same application instance with data isolation.

**Offline Mode**: For scenarios where internet connectivity is unreliable, a future version could implement a hybrid mode that uses browser-based speech recognition as a fallback, with results synced to the server when connectivity is restored.

**Mobile Application**: While the web application works on mobile browsers, a native mobile app (iOS/Android) could provide a more optimized user experience, with better control over audio input and background processing.

### Maintenance and Support

To maintain the application's reliability, the following practices are recommended:

**Regular Dependency Updates**: Keep all npm packages, especially `socket.io-client` and `next`, up to date to benefit from security patches and performance improvements.

**API Key Rotation**: Periodically rotate the Verbum AI API key and update the `VERBUM_API_KEY` environment variable to maintain security.

**Database Backups**: Ensure that regular backups of the Supabase PostgreSQL database are configured and tested.

**Monitoring and Logging**: Implement application monitoring (e.g., Sentry, LogRocket) to track errors and performance issues in production.

---

**Document Version:** 1.1
**Last Updated:** November 3, 2025
**Repository:** [https://github.com/Kevin-Shelton/iKoneworld_in-field](https://github.com/Kevin-Shelton/iKoneworld_in-field)
