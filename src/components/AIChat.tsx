
import { useState, useEffect } from "react";
import { Bot } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";

interface AIChatProps {
  guestMode?: boolean;
  maxQuestions?: number;
}

export const AIChat = ({ guestMode = false, maxQuestions = Infinity }: AIChatProps) => {
  const [apiKey, setApiKey] = useState(localStorage.getItem("geminiApiKey") || "");
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [questionsAsked, setQuestionsAsked] = useState(0);

  useEffect(() => {
    // Reset questions asked count when component mounts
    if (guestMode) {
      const storedCount = Number(localStorage.getItem("guestQuestionsAsked") || "0");
      setQuestionsAsked(storedCount);
    }
  }, [guestMode]);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("geminiApiKey", key);
    toast.success("API key saved successfully");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) {
      toast.error("Please enter your Gemini API key first");
      return;
    }
    if (!message.trim()) return;

    if (guestMode && questionsAsked >= maxQuestions) {
      toast.error(`You've reached your limit of ${maxQuestions} questions. Please sign up for unlimited access.`);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: message
            }]
          }]
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      setResponse(data.candidates[0].content.parts[0].text);
      
      if (guestMode) {
        const newCount = questionsAsked + 1;
        setQuestionsAsked(newCount);
        localStorage.setItem("guestQuestionsAsked", newCount.toString());
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to get response from AI");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4 bg-white rounded-xl shadow-md">
      {!apiKey && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 mb-2">API Key Required</h3>
          <p className="text-sm text-yellow-700 mb-3">
            Please enter your Gemini API key to use the AI chat feature. This is temporary until we integrate with Supabase.
          </p>
          <input
            type="password"
            placeholder="Enter your Gemini API key"
            className="w-full p-2 border rounded"
            onChange={(e) => saveApiKey(e.target.value)}
          />
        </div>
      )}

      {guestMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Guest Mode:</span> You have used {questionsAsked} of {maxQuestions} questions.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          placeholder="Ask me anything about your studies..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[100px]"
        />
        <Button 
          type="submit" 
          disabled={isLoading || !message.trim() || (guestMode && questionsAsked >= maxQuestions)}
          className="w-full flex items-center justify-center gap-2"
        >
          <Bot className="w-4 h-4" />
          {isLoading ? "Thinking..." : "Ask AI"}
        </Button>
      </form>

      {response && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">AI Response:</h3>
          <p className="whitespace-pre-wrap text-gray-700">{response}</p>
        </div>
      )}
    </div>
  );
};
