const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");

if (!form || !input || !chatBox) {
  throw new Error("Chat UI elements are missing from the page.");
}

const conversation = [];
let isWaitingForResponse = false;

form.addEventListener("submit", handleSubmit);

async function handleSubmit(event) {
  event.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage || isWaitingForResponse) {
    return;
  }

  isWaitingForResponse = true;
  setFormState(true);

  appendMessage("user", userMessage);
  conversation.push({ role: "user", text: userMessage });
  input.value = "";

  const pendingMessage = appendMessage("bot", "Thinking...", true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversation: [...conversation],
      }),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const aiReply = typeof data?.result === "string" ? data.result.trim() : "";

    if (!aiReply) {
      updateMessage(pendingMessage, "Sorry, no response received.", "bot");
    } else {
      updateMessage(pendingMessage, aiReply, "bot");
      conversation.push({ role: "model", text: aiReply });
    }
  } catch (error) {
    updateMessage(pendingMessage, "Failed to get response from server.", "bot");
    console.error("Chat request failed:", error);
  } finally {
    isWaitingForResponse = false;
    setFormState(false);
    input.focus();
  }
}

function appendMessage(role, text, isPending = false) {
  const message = document.createElement("div");
  message.className = `message ${role}`;

  setMessageContent(message, text, role === "bot" && !isPending);

  chatBox.appendChild(message);
  chatBox.scrollTop = chatBox.scrollHeight;

  return message;
}

function updateMessage(element, text, role) {
  if (!element) {
    return;
  }

  element.className = `message ${role}`;
  setMessageContent(element, text, role === "bot");
  chatBox.scrollTop = chatBox.scrollHeight;
}

function setFormState(disabled) {
  input.disabled = disabled;
  const submitButton = form.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = disabled;
  }
}

function setMessageContent(element, text, renderMarkdown = false) {
  if (!renderMarkdown) {
    element.textContent = text;
    return;
  }

  element.innerHTML = renderMarkdownToHtml(text);
}

function renderMarkdownToHtml(markdownText) {
  const normalizedText = markdownText.replace(/\r\n/g, "\n").trim();

  if (!normalizedText) {
    return "";
  }

  const lines = normalizedText.split("\n");
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];
  let listType = "";
  let codeLines = [];
  let isCodeBlock = false;

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return;
    }

    blocks.push(`<p>${paragraphLines.map(formatInlineMarkdown).join("<br>")}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) {
      return;
    }

    const itemsHtml = listItems.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join("");
    blocks.push(`<${listType}>${itemsHtml}</${listType}>`);
    listItems = [];
    listType = "";
  };

  const flushCodeBlock = () => {
    if (!codeLines.length) {
      return;
    }

    blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("```")) {
      if (isCodeBlock) {
        flushCodeBlock();
        isCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        isCodeBlock = true;
      }

      continue;
    }

    if (isCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      blocks.push(`<p class="chat-md-heading chat-md-heading-${level}">${formatInlineMarkdown(headingMatch[2])}</p>`);
      continue;
    }

    const unorderedListMatch = trimmedLine.match(/^[-*+]\s+(.*)$/);
    const orderedListMatch = trimmedLine.match(/^\d+\.\s+(.*)$/);

    if (unorderedListMatch || orderedListMatch) {
      const nextListType = orderedListMatch ? "ol" : "ul";

      if (listType && listType !== nextListType) {
        flushList();
      }

      flushParagraph();
      listType = nextListType;
      listItems.push((unorderedListMatch || orderedListMatch)[1]);
      continue;
    }

    if (listType) {
      flushList();
    }

    paragraphLines.push(trimmedLine);
  }

  flushParagraph();
  flushList();

  if (isCodeBlock) {
    flushCodeBlock();
  }

  return blocks.join("");
}

function formatInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>");
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}
