# HomeTrace: the memory your household is missing

**Amazon Developer Hackathon, Alexa+ track.** A self-hosted MCP server (Streamable HTTP) that gives a
household a voice-first, searchable memory of maintenance, warranties, repair history and promised follow-ups.

Nobody remembers when the RO filter was last changed, which appliance is still under warranty, or what the
technician recommended. HomeTrace records it when it happens and retrieves it when someone asks.

> Built during the hackathon window. The Alexa+ experience is simulated in a web app (no Alexa+ device needed).

## Example interactions
- "The RO filter was changed today. The technician said to replace it again in six months."
- "When was the washing machine last repaired?"
- "Which warranties expire next month?"
- "Remind me to follow up with the electrician on Friday."

## MCP tools
| Tool | What it does |
|---|---|
| `register_appliance` | Save an appliance with brand, purchase date and warranty |
| `log_maintenance` | Record a service, repair or replacement, with technician, cost, notes and next service date |
| `find_service_history` | Search past records, newest first |
| `check_warranty` | Check one appliance, or list warranties expiring soon |
| `schedule_followup` | Create a reminder to follow up with a technician or on a task |
| `complete_followup` | Mark a follow-up as done |
| `get_upcoming` | Digest of warranties, services and follow-ups due soon |

The server computes all dates itself (for example "in six months"), so the LLM never does date maths.
Data persists in `data.json`, so records survive restarts.

## How it works
- `src/mcp-server.js`: the MCP server and its tools.
- `server.js`: serves the MCP endpoint at `/mcp` and the simulator backend. An MCP client lists the
  server's tools, Gemini decides which to call, and results flow back through MCP.
- `public/index.html`: the Alexa+-style simulator with voice input and spoken replies.

## Quick start
**Requirements:** Node.js 20+ and a free Gemini API key from Google AI Studio.


```bash
git clone https://github.com/avneet-j/HomeTrace.git
cd HomeTrace
npm install
```




Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
```

Then run:

```bash
npm start
```


1. Open http://localhost:3000 in Chrome or Edge (voice input needs one of them).
2. Click **Load demo history**.
3. Type or speak the example interactions above.

Never commit your real `.env` file.

## Use the MCP server directly

The endpoint is `http://localhost:3000/mcp` (Streamable HTTP, stateless).

To inspect it, run:

```bash
npx @modelcontextprotocol/inspector
```

Choose **Streamable HTTP**, enter the URL, click Connect, then List Tools.


## Built with
Node.js, Express, Model Context Protocol SDK, Google Gemini API, vanilla HTML/CSS/JS.

## Project status

HomeTrace is a functional hackathon prototype demonstrating conversational household management through Gemini-powered tool calling and an MCP server using Streamable HTTP.

The current implementation supports a single household, stores records locally in `data.json`, and does not include authentication or multi-user access controls. The Alexa+ experience is demonstrated through a web-based simulator rather than a native Alexa+ device integration.

Before public deployment, authentication, access controls, input validation, and secure data storage should be implemented and tested.

## License
MIT, see [LICENSE](LICENSE).
