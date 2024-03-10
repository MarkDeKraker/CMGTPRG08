export interface MessageHistory  {
    messages: Message[]
}

interface Message {
    role: string
    text: string;
}