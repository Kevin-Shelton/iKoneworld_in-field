# Email Enhancement Implementation Plan

## Phase 1: Drafts Auto-Save & Resume ✅ IN PROGRESS

### API Endpoints (✅ Created)
- `/app/api/email/drafts/route.ts`
  - GET: Fetch all drafts for user
  - POST: Create/update draft
  - DELETE: Delete draft

### Frontend Changes Needed
1. **Auto-save functionality**
   - Debounced save (3 seconds after typing stops)
   - Save subject, content, recipients, language
   - Show "Saving..." / "Saved" indicator

2. **Draft loading**
   - Load drafts when "Drafts" folder selected
   - Show draft list with preview
   - Click to resume editing

3. **Draft deletion**
   - Delete draft after successful send
   - Manual delete option in drafts folder

### State Variables Added
```typescript
const [drafts, setDrafts] = useState<any[]>([]);
const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);
const [draftContent, setDraftContent] = useState({ subject: '', content: '', recipients: [] });
const draftSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
```

---

## Phase 2: Unread/Read Visual Indicators

### Database (✅ Already exists)
- `email_messages.is_read` column
- Auto-mark as read when opening message

### Frontend Changes Needed
1. **Thread list styling**
   - Bold text for threads with unread messages
   - Blue dot indicator for unread
   - Count unread messages per thread

2. **Folder counts**
   - Show unread count on Inbox folder
   - Show total count on other folders
   - Real-time updates

3. **Message styling**
   - Different background for unread messages
   - Mark as read/unread button

### Functions to Add
```typescript
async function getUnreadCounts() {
  // Query unread messages per thread
  // Update unreadCounts state
}

async function markAsUnread(messageId: string) {
  // Toggle is_read flag
}

async function getFolderCounts() {
  // Count messages in each folder
  // Update folderCounts state
}
```

---

## Phase 3: Keyboard Shortcuts

### Shortcuts to Implement
- `C` - Compose new email
- `R` - Reply to selected thread
- `A` - Reply all
- `F` - Forward
- `Delete` / `Backspace` - Move to trash
- `J` - Next thread
- `K` - Previous thread
- `Esc` - Close composer/cancel
- `/` - Focus search
- `Enter` - Open selected thread

### Implementation
```typescript
useEffect(() => {
  function handleKeyPress(e: KeyboardEvent) {
    // Ignore if typing in input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      if (e.key !== 'Escape') return;
    }

    switch(e.key.toLowerCase()) {
      case 'c':
        handleComposeNew();
        break;
      case 'r':
        if (selectedThread) handleReply();
        break;
      // ... more shortcuts
    }
  }

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [selectedThread, composerMode]);
```

---

## Phase 4: Threading Improvements

### Changes Needed
1. **Message count in thread list**
   - Show "X messages" below subject
   - Query message count per thread

2. **Thread preview**
   - Show snippet of latest message
   - Truncate to 50 characters

3. **Participant avatars**
   - Show initials in colored circles
   - Stack multiple participants

### Functions to Add
```typescript
async function getThreadMessageCounts() {
  const { data } = await supabase
    .from('email_messages')
    .select('thread_id')
    .eq('is_deleted', false);
  
  const counts = {};
  data?.forEach(msg => {
    counts[msg.thread_id] = (counts[msg.thread_id] || 0) + 1;
  });
  
  setThreadMessageCounts(counts);
}
```

---

## Phase 5: Additional Enhancements

### Priority Features
1. **Email templates** - Save common responses
2. **Scheduled sending** - Send email at specific time
3. **Email signatures** - Auto-append signature
4. **Attachments** - File upload support
5. **Rich text editor** - Formatting options

### Nice-to-Have
1. **Labels/tags** - Organize emails
2. **Filters/rules** - Auto-organize
3. **Snooze** - Remind later
4. **Undo send** - 5-second window
5. **Email tracking** - Read receipts

---

## Implementation Order

1. ✅ API endpoints for drafts
2. 🔄 Unread indicators (high impact, easy)
3. 🔄 Keyboard shortcuts (power user feature)
4. 🔄 Drafts UI (moderate complexity)
5. 🔄 Threading improvements (polish)
6. ⏳ Additional features (as needed)

---

## Testing Checklist

### Drafts
- [ ] Auto-save while typing
- [ ] Resume draft from drafts folder
- [ ] Delete draft after sending
- [ ] Multiple drafts management

### Unread Indicators
- [ ] Bold text for unread threads
- [ ] Unread counts on folders
- [ ] Mark as read when opening
- [ ] Manual mark as unread

### Keyboard Shortcuts
- [ ] All shortcuts work
- [ ] Don't interfere with typing
- [ ] Esc closes composer
- [ ] Navigation with J/K

### Threading
- [ ] Message counts display
- [ ] Thread preview shows
- [ ] Counts update in real-time

---

## Files to Modify

1. `/app/email/page-enhanced.tsx` - Main email page
2. `/app/api/email/drafts/route.ts` - ✅ Created
3. `/components/EmailComposer.tsx` - Add draft save hooks
4. `/app/email/page.tsx` - Replace with enhanced version

---

## Estimated Completion

- Unread indicators: 30 minutes
- Keyboard shortcuts: 20 minutes
- Drafts UI: 45 minutes
- Threading improvements: 30 minutes
- Testing & polish: 30 minutes

**Total: ~2.5 hours**
