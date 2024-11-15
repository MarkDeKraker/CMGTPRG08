import { Button, TextInput } from "@mantine/core";
import Chat from "./Chat";
import { useEffect, useRef, useState } from "react";

export default function ChatHistory() {
  // State
  const [chats, setChats] = useState<any[]>([]);
  const [text, setText] = useState<string>("");
  const [isLoading, setLoading] = useState<boolean>(false);
  const chatDivRef = useRef<HTMLDivElement>(null);
  const [completionTokens, setCompletionTokens] = useState<number>(0);
  const [promptTokens, setPromptTokens] = useState<number>(0);
  const [totalTokens, setTotalTokens] = useState<number>(0);

  // Makes the chat always go to the bottom for better viewing experience
  useEffect(() => {
    scrollToBottom();
  }, [chats]);

  // Set chat and token history if available so you can chat where you left off.
  useEffect(() => {
    fetchExistingChatHistory();
    fetchExistingTokenUsageHistory();
  }, []);

  // Function to add a new chat to the chathistory
  const addChat = () => {
    if (text == "") {
      return;
    }
    setLoading(true);
    const newChat = {
      role: "human",
      text: text,
    };

    setChats((prevChats) => [...prevChats, newChat]);

    const existingChatHistory = localStorage.getItem("chatHistory");
    const parsedChatHistory = existingChatHistory
      ? JSON.parse(existingChatHistory)
      : [];

    const updatedChatHistory = [...parsedChatHistory, newChat];
    localStorage.setItem("chatHistory", JSON.stringify(updatedChatHistory));

    setText("");
    callApi();
  };

  // Function that calls the backend of the chatservice
  function callApi() {
    const apiUrl = `${import.meta.env.VITE_API_URL}/api/postData`;

    const chatHistory = JSON.parse(localStorage.getItem("chatHistory") ?? "[]");

    const requestData = {
      chatHistory,
    };

    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    };

    fetch(apiUrl, requestOptions)
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        const newChat = {
          role: "ai",
          text: data.response.kwargs.content,
        };
        setChats((prevChats) => [...prevChats, newChat]);
        addChatToLocalStorage(newChat, data.chatHistory);
        setTokens(data.tokenUsage);
        setLoading(false);
      })
      .catch(() => {
        const newChat = {
          role: "ai",
          text: "Beste gebruiker, er is een fout opgetreden met het verwerken van uw bericht. Probeer het op een later moment opnieuw.",
        };
        setChats((prevChats) => [...prevChats, newChat]);
        setLoading(false);
      });
  }

  // Function that fetches the existing chat history
  function fetchExistingChatHistory() {
    const chatHistory = JSON.parse(localStorage.getItem("chatHistory") ?? "[]");
    if (chatHistory.length > 0) {
      setChats(chatHistory);
    }
  }

  // Function that fetches the existing tokenusage history
  function fetchExistingTokenUsageHistory() {
    const tokenUsageHistory = JSON.parse(
      localStorage.getItem("tokenUsageHistory") ?? "{}"
    );
    const hasTokenUsageHistory =
      Object.keys(tokenUsageHistory).length == 0 ? false : true;
    if (hasTokenUsageHistory) {
      setPromptTokens(tokenUsageHistory.promptTokens);
      setCompletionTokens(tokenUsageHistory.completionTokens);
      setTotalTokens(tokenUsageHistory.totalTokens);
    } else {
      localStorage.setItem("tokenUsageHistory", "{}");
    }
  }

  // Function that add the newest chat to the chathistory in localstorage
  function addChatToLocalStorage(newChat: any, chatHistory: any) {
    const newChatHistory = chatHistory;

    newChatHistory.push(newChat);

    localStorage.setItem("chatHistory", JSON.stringify(newChatHistory));
  }

  // Function that sets the token usage and updates the localstorage
  function setTokens(tokens: any) {
    let existingTokenUsageHistory = JSON.parse(
      localStorage.getItem("tokenUsageHistory") ?? "{}"
    );

    if (Object.keys(existingTokenUsageHistory).length === 0) {
      existingTokenUsageHistory = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    }

    const totalPromptTokens =
      existingTokenUsageHistory.promptTokens + tokens.tokenUsage.promptTokens;
    const totalCompletionTokens =
      existingTokenUsageHistory.completionTokens +
      tokens.tokenUsage.completionTokens;
    const totalTokens = totalPromptTokens + totalCompletionTokens;

    const newTokenUsage = {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalTokens,
    };

    setPromptTokens(totalPromptTokens);
    setCompletionTokens(totalCompletionTokens);
    setTotalTokens(totalTokens);

    localStorage.setItem("tokenUsageHistory", JSON.stringify(newTokenUsage));
  }

  // Function that resets all the config / history
  function resetChat() {
    setText("");
    setChats([]);
    setCompletionTokens(0);
    setTotalTokens(0);
    setPromptTokens(0);
    localStorage.removeItem("chatHistory");
    localStorage.removeItem("tokenUsageHistory");

    setLoading(false);
  }

  // function that scrolls to the bottom in the div
  const scrollToBottom = () => {
    if (chatDivRef.current) {
      chatDivRef.current.scrollTop = chatDivRef.current.scrollHeight;
    }
  };

  return (
    <>
      <div className="flex flex-col space-y-2">
        <div className="w-[550px] border-2 rounded-lg h-[575px] shadow-md bg-white">
          <p className="text-center border-b-2">RDW Chatbot</p>
          <div
            className="p-2 max-h-[540px]"
            ref={chatDivRef}
            style={{ overflowY: "auto" }}
          >
            {chats.map((chat, index) => (
              <Chat key={index} text={chat.text} role={chat.role} />
            ))}
          </div>
        </div>
        <div className="border-2 rounded-lg shadow-md bg-white">
          <div className="p-2 space-y-2">
            <TextInput
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type hier je bericht..."
              className="w-[100%]"
            />
            <Button
              loading={isLoading}
              fullWidth
              onClick={() => addChat()}
              variant="filled"
              color="#cc3300"
            >
              Verstuur bericht
            </Button>
            <Button
              fullWidth
              onClick={() => resetChat()}
              variant="filled"
              color="#000033"
            >
              Reset chat
            </Button>
          </div>
        </div>
        {/* <div className=" border-2 rounded-lg shadow-md bg-white">
          <div className="p-2 space-y-2">
            <p className="font-medium">Token verbruik</p>
            <p className="text-sm">Completion tokens: {completionTokens}</p>
            <p className="text-sm">Prompt tokens: {promptTokens}</p>
            <p className="text-sm">Total tokens: {totalTokens}</p>
          </div>
        </div> */}
      </div>
    </>
  );
}
