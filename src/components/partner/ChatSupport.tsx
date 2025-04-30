import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/use-toast';
import { format } from 'date-fns';
import { Send, AlertCircle, Paperclip, Loader2, Video, Phone } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  read: boolean;
  sender_name?: string;
  sender_avatar?: string;
  is_from_me: boolean;
}

const ChatSupport: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { userData } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSupport = { id: 'support', name: 'Support Team' };

  useEffect(() => {
    if (userData?.id) {
      fetchMessages();
      
      // Subscribe to new messages
      const subscription = supabase
        .channel('chat_messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userData.id}`
        }, payload => {
          // Add the new message to state
          const newMsg = payload.new as Message;
          setMessages(current => [...current, {
            ...newMsg,
            is_from_me: false,
            sender_name: 'Support Team'
          }]);
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [userData]);

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      
      // Fetch messages between the user and support
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(name)
        `)
        .or(`sender_id.eq.${userData?.id},receiver_id.eq.${userData?.id}`)
        .order('created_at', { ascending: true });
      
      if (error) throw error;

      // Format messages for display
      const formattedMessages = (data || []).map((message: any) => ({
        ...message,
        is_from_me: message.sender_id === userData?.id,
        sender_name: message.sender.name
      }));

      setMessages(formattedMessages);

      // Mark unread messages as read
      const unreadMessageIds = formattedMessages
        .filter(msg => !msg.is_from_me && !msg.read)
        .map(msg => msg.id);

      if (unreadMessageIds.length > 0) {
        await supabase
          .from('messages')
          .update({ read: true })
          .in('id', unreadMessageIds);
      }
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load messages. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      setSending(true);
      
      // Insert the message
      const { data, error } = await supabase
        .from('messages')
        .insert({
          content: newMessage.trim(),
          sender_id: userData?.id,
          receiver_id: 'support', // Support team ID
          read: false
        })
        .select('*')
        .single();
      
      if (error) throw error;

      // Add to messages list with sender info
      setMessages([...messages, {
        ...data,
        is_from_me: true,
        sender_name: userData?.name || 'You'
      }]);
      
      // Clear input
      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, 'h:mm a');
  };

  const formatMessageDate = (timestamp: string) => {
    return format(new Date(timestamp), 'MMMM d, yyyy');
  };

  // Group messages by date
  const messagesByDate: Record<string, Message[]> = {};
  messages.forEach(message => {
    const date = formatMessageDate(message.created_at);
    if (!messagesByDate[date]) {
      messagesByDate[date] = [];
    }
    messagesByDate[date].push(message);
  });

  const dateKeys = Object.keys(messagesByDate);

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-bold dark:text-white">Support Chat</h1>
        
        <div className="flex space-x-2">
          <button
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            title="Audio Call"
          >
            <Phone className="h-5 w-5" />
          </button>
          <button
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            title="Video Call"
          >
            <Video className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700 flex flex-col">
        {/* Chat header */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 flex items-center">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-3">
            <span className="text-blue-600 dark:text-blue-300 font-bold">S</span>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              {chatSupport.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Typically replies within a few hours
            </p>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50 dark:bg-gray-900/50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No messages yet</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Send a message to the support team and they'll get back to you as soon as possible.
              </p>
            </div>
          ) : (
            dateKeys.map(date => (
              <div key={date}>
                <div className="text-center mb-4">
                  <span className="inline-block px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300">
                    {date}
                  </span>
                </div>
                
                <div className="space-y-4">
                  {messagesByDate[date].map(message => (
                    <div 
                      key={message.id} 
                      className={`flex ${message.is_from_me ? 'justify-end' : 'justify-start'}`}
                    >
                      {!message.is_from_me && (
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex-shrink-0 flex items-center justify-center mr-2">
                          <span className="text-blue-600 dark:text-blue-300 font-bold text-xs">S</span>
                        </div>
                      )}
                      
                      <div 
                        className={`max-w-[70%] px-4 py-3 rounded-lg ${
                          message.is_from_me 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border dark:border-gray-700'
                        }`}
                      >
                        <div className="text-sm">{message.content}</div>
                        <div className={`text-xs mt-1 text-right ${
                          message.is_from_me ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {formatMessageTime(message.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="p-4 border-t dark:border-gray-600 bg-white dark:bg-gray-800">
          <div className="flex items-end">
            <button 
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              title="Attach File"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <div className="flex-1 mx-2">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type a message..."
                className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
                rows={1}
                style={{ minHeight: "60px" }}
              ></textarea>
            </div>
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className={`p-3 rounded-full ${
                !newMessage.trim() || sending
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } flex-shrink-0`}
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatSupport;