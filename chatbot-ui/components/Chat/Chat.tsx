import { IconClearAll, IconSettings } from '@tabler/icons-react';
import {
  MutableRefObject,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';

import { useTranslation } from 'next-i18next';

import { getEndpoint } from '@/utils/app/api';
import {
  saveConversation,
  saveConversations,
  updateConversation,
} from '@/utils/app/conversation';
import { throttle } from '@/utils/data/throttle';

import { ChatBody, Conversation, Message } from '@/types/chat';
import { Plugin } from '@/types/plugin';

import HomeContext from '@/pages/api/home/home.context';

import Spinner from '../Spinner';
import { ChatInput } from './ChatInput';
import { ChatLoader } from './ChatLoader';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { ModelSelect } from './ModelSelect';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';
import { MemoizedChatMessage } from './MemoizedChatMessage';

interface Props {
  stopConversationRef: MutableRefObject<boolean>;
}

export const Chat = memo(({ stopConversationRef }: Props) => {
  const { t } = useTranslation('chat');

  const {
    state: {
      selectedConversation,
      conversations,
      models,
      apiKey,
      pluginKeys,
      serverSideApiKeyIsSet,
      messageIsStreaming,
      modelError,
      loading,
      prompts,
    },
    handleUpdateConversation,
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  const [currentMessage, setCurrentMessage] = useState<Message>();
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showScrollDownButton, setShowScrollDownButton] =
    useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(
    async (message: Message, deleteCount = 0, plugin: Plugin | null = null) => {
      if (selectedConversation) {
        let updatedConversation: Conversation;
        if (deleteCount) {
          const updatedMessages = [...selectedConversation.messages];
          for (let i = 0; i < deleteCount; i++) {
            updatedMessages.pop();
          }
          updatedConversation = {
            ...selectedConversation,
            messages: [...updatedMessages, message],
          };
        } else {
          updatedConversation = {
            ...selectedConversation,
            messages: [...selectedConversation.messages, message],
          };
        }
        homeDispatch({
          field: 'selectedConversation',
          value: updatedConversation,
        });
        homeDispatch({ field: 'loading', value: true });
        homeDispatch({ field: 'messageIsStreaming', value: true });

        const chatBody: ChatBody = {
          model: updatedConversation.model,
          messages: updatedConversation.messages,
          key: apiKey,
          prompt: updatedConversation.prompt,
          temperature: updatedConversation.temperature,
        };

        //This block is not required
        let body;
        if (!plugin) {
          body = JSON.stringify(chatBody);
        } else {
          body = JSON.stringify({
            ...chatBody,
            googleAPIKey: pluginKeys
              .find((key) => key.pluginId === 'google-search')
              ?.requiredKeys.find((key) => key.key === 'GOOGLE_API_KEY')?.value,
            googleCSEId: pluginKeys
              .find((key) => key.pluginId === 'google-search')
              ?.requiredKeys.find((key) => key.key === 'GOOGLE_CSE_ID')?.value,
          });
        }



        console.log("In chat.tsx");
        //console.log(body);
        console.log("@@@ Number of Messages---updatedConversation:", updatedConversation);

        let flaskApiUrl = "";
        let jsonResponse;

        if (updatedConversation.messages.length == 1) {
          console.log("quest", updatedConversation.messages.length);
          flaskApiUrl = 'http://127.0.0.1:5000/question';
          let qpostData = {
            quiz_length: 3,
            current_question: 0,
            score: 0
          };
          // Fetch the response from the Flask API with a POST request
          const response = await fetch(flaskApiUrl, {
            method: 'POST', // Set the method to POST
            headers: {
              'Content-Type': 'application/json', // Set the content type to JSON
            },
            body: JSON.stringify(qpostData) // Stringify your post data
          });

          homeDispatch({ field: 'loading', value: false });

          if (!response.ok) {
            homeDispatch({ field: 'messageIsStreaming', value: false });
            toast.error(response.statusText);
            return;
          }


          jsonResponse = await response.json();
          console.log("JSON Response:", jsonResponse);

          // store score, quiz length, question, start index, end index, study index
          localStorage.setItem('apiProperties', JSON.stringify(jsonResponse));
        } else {
          console.log("answer + question ", updatedConversation.messages.length);
          flaskApiUrl = 'http://127.0.0.1:5000/answer';

          let storedProperties = localStorage.getItem('apiProperties');
          let parsedProperties;
          if (storedProperties) {
            try {
              parsedProperties = JSON.parse(storedProperties);
            } catch (error) {
              console.error('Error parsing JSON from localStorage:', error);
            }
          }

          let apostData = {
            quiz_length: parsedProperties.quiz_length,
            current_question: parsedProperties.current_question,
            score: parsedProperties.score,
            study_index: parsedProperties.study_index,
            start_index: parsedProperties.start_index,
            end_index: parsedProperties.end_index,
            question: parsedProperties.question,
            answer: updatedConversation.messages[updatedConversation.messages.length-1].content,
          };

          // Fetch the response from the Flask API with a POST request
          let response = await fetch(flaskApiUrl, {
            method: 'POST', // Set the method to POST
            headers: {
              'Content-Type': 'application/json', // Set the content type to JSON
            },
            body: JSON.stringify(apostData) // Stringify your post data
          });

          homeDispatch({ field: 'loading', value: false });

          if (!response.ok) {
            homeDispatch({ field: 'messageIsStreaming', value: false });
            toast.error(response.statusText);
            return;
          }


          jsonResponse = await response.json();
          console.log("JSON Response:", jsonResponse);

          console.log("!!! Answer Result: ", jsonResponse.answer_result)
          // store score, quiz length, question, start index, end index, study index
          //localStorage.setItem('apiProperties', JSON.stringify(jsonResponse));

          //preparing next question
          flaskApiUrl = 'http://127.0.0.1:5000/question';
          let qpostData = {
            quiz_length: jsonResponse.quiz_length,
            current_question: jsonResponse.current_question,
            score: jsonResponse.score
          };
          // Fetch the response from the Flask API with a POST request
          response = await fetch(flaskApiUrl, {
            method: 'POST', // Set the method to POST
            headers: {
              'Content-Type': 'application/json', // Set the content type to JSON
            },
            body: JSON.stringify(qpostData) // Stringify your post data
          });

          homeDispatch({ field: 'loading', value: false });

          if (!response.ok) {
            homeDispatch({ field: 'messageIsStreaming', value: false });
            toast.error(response.statusText);
            return;
          }


          jsonResponse = await response.json();
          console.log("JSON Response:", jsonResponse);

          // store score, quiz length, question, start index, end index, study index
          localStorage.setItem('apiProperties', JSON.stringify(jsonResponse));
        }


        // console.log("selectedConversation:", selectedConversation);
        // console.log("updatedConversation:", updatedConversation);
        let newMessage: Message;

        if(jsonResponse.humourous_score)
        {
          newMessage = {
            role: "assistant", // Or any other valid value from Role
            content: jsonResponse.humourous_score//.replace(/\n/g, "<br/>")
          };
        }
        else 
        {
          newMessage = {
            role: "assistant", // Or any other valid value from Role
            content: jsonResponse.question//.replace(/\n/g, "<br/>")
          };
        }
        

        const updatedMessages = [...updatedConversation.messages, ...[newMessage]];

        updatedConversation = {
          ...updatedConversation,
          messages: updatedMessages,
        };

        console.log("--selectedConversation:", selectedConversation.messages);
        console.log("---updatedConversation:", updatedConversation);

        homeDispatch({
          field: 'selectedConversation',
          value: updatedConversation,
        });
        saveConversation(updatedConversation);
        const updatedConversations: Conversation[] = conversations.map(
          (conversation) => {
            if (conversation.id === selectedConversation.id) {
              return updatedConversation;
            }
            return conversation;
          },
        );
        if (updatedConversations.length === 0) {
          updatedConversations.push(updatedConversation);
        }
        homeDispatch({ field: 'conversations', value: updatedConversations });
        saveConversations(updatedConversations);
        homeDispatch({ field: 'messageIsStreaming', value: false });
      }
    },
    [
      apiKey,
      conversations,
      pluginKeys,
      selectedConversation,
      stopConversationRef,
    ],
  );

  const scrollToBottom = useCallback(() => {
    if (autoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      textareaRef.current?.focus();
    }
  }, [autoScrollEnabled]);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      const bottomTolerance = 30;

      if (scrollTop + clientHeight < scrollHeight - bottomTolerance) {
        setAutoScrollEnabled(false);
        setShowScrollDownButton(true);
      } else {
        setAutoScrollEnabled(true);
        setShowScrollDownButton(false);
      }
    }
  };

  const handleScrollDown = () => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

  const handleSettings = () => {
    setShowSettings(!showSettings);
  };

  const onClearAll = () => {
    if (
      confirm(t<string>('Are you sure you want to clear all messages?')) &&
      selectedConversation
    ) {
      handleUpdateConversation(selectedConversation, {
        key: 'messages',
        value: [],
      });
    }
  };

  const scrollDown = () => {
    if (autoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView(true);
    }
  };
  const throttledScrollDown = throttle(scrollDown, 250);

  // useEffect(() => {
  //   console.log('currentMessage', currentMessage);
  //   if (currentMessage) {
  //     handleSend(currentMessage);
  //     homeDispatch({ field: 'currentMessage', value: undefined });
  //   }
  // }, [currentMessage]);

  useEffect(() => {
    throttledScrollDown();
    selectedConversation &&
      setCurrentMessage(
        selectedConversation.messages[selectedConversation.messages.length - 2],
      );
  }, [selectedConversation, throttledScrollDown]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setAutoScrollEnabled(entry.isIntersecting);
        if (entry.isIntersecting) {
          textareaRef.current?.focus();
        }
      },
      {
        root: null,
        threshold: 0.5,
      },
    );
    const messagesEndElement = messagesEndRef.current;
    if (messagesEndElement) {
      observer.observe(messagesEndElement);
    }
    return () => {
      if (messagesEndElement) {
        observer.unobserve(messagesEndElement);
      }
    };
  }, [messagesEndRef]);

  return (
    <div className="relative flex-1 overflow-hidden bg-white dark:bg-[#343541]">
      {!(apiKey || serverSideApiKeyIsSet) ? (
        <div className="mx-auto flex h-full w-[300px] flex-col justify-center space-y-6 sm:w-[600px]">
          <div className="text-center text-4xl font-bold text-black dark:text-white">
            Welcome to Chatbot UI
          </div>
          <div className="text-center text-lg text-black dark:text-white">
            <div className="mb-8">{`Chatbot UI is an open source clone of OpenAI's ChatGPT UI.`}</div>
            <div className="mb-2 font-bold">
              Important: Chatbot UI is 100% unaffiliated with OpenAI.
            </div>
          </div>
          <div className="text-center text-gray-500 dark:text-gray-400">
            <div className="mb-2">
              Chatbot UI allows you to plug in your API key to use this UI with
              their API.
            </div>
            <div className="mb-2">
              It is <span className="italic">only</span> used to communicate
              with their API.
            </div>
            <div className="mb-2">
              {t(
                'Please set your OpenAI API key in the bottom left of the sidebar.',
              )}
            </div>
            <div>
              {t("If you don't have an OpenAI API key, you can get one here: ")}
              <a
                href="https://platform.openai.com/account/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 hover:underline"
              >
                openai.com
              </a>
            </div>
          </div>
        </div>
      ) : modelError ? (
        <ErrorMessageDiv error={modelError} />
      ) : (
        <>
          <div
            className="max-h-full overflow-x-hidden"
            ref={chatContainerRef}
            onScroll={handleScroll}
          >
            {selectedConversation?.messages.length === 0 ? (
              <>
                <div className="mx-auto flex flex-col space-y-5 md:space-y-10 px-3 pt-5 md:pt-12 sm:max-w-[600px]">
                  <div className="text-center text-3xl font-semibold text-gray-800 dark:text-gray-100">
                    {models.length === 0 ? (
                      <div>
                        <Spinner size="16px" className="mx-auto" />
                      </div>
                    ) : (
                      'Chatbot UI'
                    )}
                  </div>

                  {models.length > 0 && (
                    <div className="flex h-full flex-col space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-600">
                      <ModelSelect />

                      <SystemPrompt
                        conversation={selectedConversation}
                        prompts={prompts}
                        onChangePrompt={(prompt) =>
                          handleUpdateConversation(selectedConversation, {
                            key: 'prompt',
                            value: prompt,
                          })
                        }
                      />

                      <TemperatureSlider
                        label={t('Temperature')}
                        onChangeTemperature={(temperature) =>
                          handleUpdateConversation(selectedConversation, {
                            key: 'temperature',
                            value: temperature,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="sticky top-0 z-10 flex justify-center border border-b-neutral-300 bg-neutral-100 py-2 text-sm text-neutral-500 dark:border-none dark:bg-[#444654] dark:text-neutral-200">
                  {t('Model')}: {selectedConversation?.model.name} | {t('Temp')}
                  : {selectedConversation?.temperature} |
                  <button
                    className="ml-2 cursor-pointer hover:opacity-50"
                    onClick={handleSettings}
                  >
                    <IconSettings size={18} />
                  </button>
                  <button
                    className="ml-2 cursor-pointer hover:opacity-50"
                    onClick={onClearAll}
                  >
                    <IconClearAll size={18} />
                  </button>
                </div>
                {showSettings && (
                  <div className="flex flex-col space-y-10 md:mx-auto md:max-w-xl md:gap-6 md:py-3 md:pt-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
                    <div className="flex h-full flex-col space-y-4 border-b border-neutral-200 p-4 dark:border-neutral-600 md:rounded-lg md:border">
                      <ModelSelect />
                    </div>
                  </div>
                )}

                {selectedConversation?.messages.map((message, index) => (
                  <MemoizedChatMessage
                    key={index}
                    message={message}
                    messageIndex={index}
                    onEdit={(editedMessage) => {
                      setCurrentMessage(editedMessage);
                      // discard edited message and the ones that come after then resend
                      handleSend(
                        editedMessage,
                        selectedConversation?.messages.length - index,
                      );
                    }}
                  />
                ))}

                {loading && <ChatLoader />}

                <div
                  className="h-[162px] bg-white dark:bg-[#343541]"
                  ref={messagesEndRef}
                />
              </>
            )}
          </div>

          <ChatInput
            stopConversationRef={stopConversationRef}
            textareaRef={textareaRef}
            onSend={(message, plugin) => {
              setCurrentMessage(message);
              handleSend(message, 0, plugin);
            }}
            onScrollDownClick={handleScrollDown}
            onRegenerate={() => {
              if (currentMessage) {
                handleSend(currentMessage, 2, null);
              }
            }}
            showScrollDownButton={showScrollDownButton}
          />
        </>
      )}
    </div>
  );
});
Chat.displayName = 'Chat';
