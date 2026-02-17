# Urbanism and AI Reading Group App

A dynamic reading list application for the MIT LCAU Urbanism and AI Reading Group.

## About
This is a dynamic reading list application for the MIT LCAU Urbanism and AI Reading Group. It allows members to propose readings (books, papers, videos) and vote on them to decide the topic for upcoming sessions.

## Features
- **Dynamic Reading List**: Stores readings and votes in a local JSON database.
- **Smart Scheduling**: Automatically manages voting windows based on the semester schedule.
- **Voting Logic**: Enforces a limit of 3 votes per user.
- **Proposal Rules**: Users can only have 1 active proposal at a time (updates existing if not yet voted/selected).

## Rules
### Voting Deadline
Voting closes at **11:59:59 PM EST** on the Tuesday before each session (the day before the reading group meets).
*(Note: For the very first session, voting may close earlier to allow reading time, e.g., 12 days prior).*

### Reading Proposals
- **1 Reading Per 2 Weeks**: To ensure high-quality curation, each member is limited to **one active proposal** at a time. 
- If you submit a new proposal while you have one pending (not yet selected or archived), your existing proposal will be updated.
- Once your reading is selected or discussed, you are free to propose a new one.


## Setup & Run

### 1. Configuration (.env)
Create a `.env` file in the root directory with the following keys:
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SESSION_SECRET=your_random_secret_string
```
*(You need Google OAuth credentials from the Google Cloud Console to enable login)*

### 2. Install Dependencies (First time only)
    ```bash
    npm install
    ```

### 3. Start Server
    ```bash
    node server.js
    ```

### 4. Open Application
    Go to [http://localhost:3000](http://localhost:3000)

## Automation
The application manages data automatically in:
- `data/readingList.json`: Main database of readings and votes.
- `data/newReadingList.json`: Staging area (can be merged if needed, though self-hosted setup writes directly to main list if configured).

**To Close Voting & Pick a Winner:**
Run the manager script:
```bash
node scripts/manager.js decide
```
This will calculate the winner based on votes and tie-breaking rules, and display the draft announcement email.
