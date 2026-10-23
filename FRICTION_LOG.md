# HomeTrace — Hackathon Friction Log

This log documents development and testing friction encountered while building HomeTrace, a household maintenance assistant using Gemini and MCP. Entries describe the areas where I experienced difficulty; exact error messages and severity should be added only where confirmed.

## 1. Understanding MCP Tool Communication

- **Task:** Understand how the MCP server communicates with tools and how those tools fit into HomeTrace.
- **Expected vs. actual:** I needed to understand how the server exposes tools and how the application communicates with them. Understanding this interaction required additional learning and experimentation.
- **Severity:** To be confirmed.
- **Workaround:** To be confirmed based on the steps used during development.
- **Suggested improvement:** Provide a beginner-friendly end-to-end example showing tool registration, client communication, tool invocation, and returned results, including common debugging steps.

## 2. Gemini Model and API Configuration

- **Task:** Configure Gemini model selection and API access for HomeTrace.
- **Expected vs. actual:** I needed to determine how to configure the model and API credentials correctly. The specific configuration issue and its effect on development need to be documented.
- **Severity:** To be confirmed.
- **Workaround:** To be confirmed.
- **Suggested improvement:** Provide clear model-configuration examples, API-key setup instructions, and actionable error messages for invalid credentials or unsupported model names.

## 3. Node.js, npm, Zod, and Dependency Debugging

- **Task:** Set up and debug the project's Node.js environment and dependencies.
- **Expected vs. actual:** Dependency and environment debugging was an area of friction during development. The specific package errors, version conflicts, or runtime behavior need confirmation before describing them in detail.
- **Severity:** To be confirmed.
- **Workaround:** To be confirmed.
- **Suggested improvement:** Provide troubleshooting guidance for common Node.js and npm setup issues, dependency compatibility, Zod validation errors, and runtime diagnostics.

## 4. Testing Features and Diagnosing Failures

- **Task:** Test HomeTrace features and identify why a feature did not behave as expected.
- **Expected vs. actual:** Testing required diagnosing feature behavior rather than simply confirming that the application ran. The exact feature failure and root cause need to be recorded from the actual debugging experience.
- **Severity:** To be confirmed.
- **Workaround:** To be confirmed.
- **Suggested improvement:** Provide clearer error reporting, structured logs linking requests to tool calls and responses, and a practical testing guide for diagnosing failures across the application.
