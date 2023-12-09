import { Message } from '@/types/chat';
import { OpenAIModel } from '@/types/openai';

import { AZURE_DEPLOYMENT_ID, OPENAI_API_HOST, OPENAI_API_TYPE, OPENAI_API_VERSION, OPENAI_ORGANIZATION } from '../app/const';

import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';

export class OpenAIError extends Error {
  type: string;
  param: string;
  code: string;

  constructor(message: string, type: string, param: string, code: string) {
    super(message);
    this.name = 'OpenAIError';
    this.type = type;
    this.param = param;
    this.code = code;
  }
}

export const OpenAIStream = async (model: OpenAIModel,
      systemPrompt: string,
      temperature : number,
      key: string,
      messages: Message[]
    ) => {
  // The URL of your Flask API
  const flaskApiUrl = 'http://127.0.0.1:5000/question';
  console.log(systemPrompt);
  console.log(temperature);
  console.log(key);
  console.log(messages);

  try {

    const postData = {
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
      body: JSON.stringify(postData) // Stringify your post data
    });

    // Check if the fetch was successful
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    // Read the response text (you can also use response.json() if your Flask API returns JSON)
    const responseJSON = await response.json();

    // Here you can handle the response text, e.g., parse JSON, or directly return it
    console.log(responseJSON);

    // Let's assume responseJSON has a property named 'data' you want to store
    const propertiesToStore = responseJSON.data;
    // Store the properties in localStorage
    localStorage.setItem('apiProperties', JSON.stringify(propertiesToStore));
    

    // If you want to process this text as a stream, you can do so here
    // For example, you can create a new stream that just enqueues this text
    const stream = new ReadableStream({
      start(controller) {
        // Convert the text to a Uint8Array and enqueue it to the stream
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(responseJSON.question.replace(/\n/g, "  \n")));

        // Close the stream
        controller.close();
      }
    });

    // Return the stream
    return stream;

  } catch (error) {
    // Handle any errors that occurred during the fetch
    console.error('Fetch error:', error);
    throw error;
  }
};

// export const OpenAIStream = async (
//   model: OpenAIModel,
//   systemPrompt: string,
//   temperature : number,
//   key: string,
//   messages: Message[],
// ) => {
//   let url = `${OPENAI_API_HOST}/v1/chat/completions`;
//   if (OPENAI_API_TYPE === 'azure') {
//     url = `${OPENAI_API_HOST}/openai/deployments/${AZURE_DEPLOYMENT_ID}/chat/completions?api-version=${OPENAI_API_VERSION}`;
//     console.log(url);
//   }
//   const res = await fetch(url, {
//     headers: {
//       'Content-Type': 'application/json',
//       ...(OPENAI_API_TYPE === 'openai' && {
//         Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`
//       }),
//       ...(OPENAI_API_TYPE === 'azure' && {
//         'api-key': `${key ? key : process.env.OPENAI_API_KEY}`
//       }),
//       ...((OPENAI_API_TYPE === 'openai' && OPENAI_ORGANIZATION) && {
//         'OpenAI-Organization': OPENAI_ORGANIZATION,
//       }),
//     },
//     method: 'POST',
//     body: JSON.stringify({
//       ...(OPENAI_API_TYPE === 'openai' && {model: model.id}),
//       messages: [
//         {
//           role: 'system',
//           content: systemPrompt,
//         },
//         ...messages,
//       ],
//       max_tokens: 1000,
//       temperature: temperature,
//       stream: true,
//     }),
//   });

//   const encoder = new TextEncoder();
//   const decoder = new TextDecoder();

//   if (res.status !== 200) {
//     const result = await res.json();
//     if (result.error) {
//       throw new OpenAIError(
//         result.error.message,
//         result.error.type,
//         result.error.param,
//         result.error.code,
//       );
//     } else {
//       throw new Error(
//         `OpenAI API returned an error: ${
//           decoder.decode(result?.value) || result.statusText
//         }`,
//       );
//     }
//   }

//   const stream = new ReadableStream({
//     async start(controller) {
//       const onParse = (event: ParsedEvent | ReconnectInterval) => {
//         if (event.type === 'event') {
//           const data = event.data;

//           try {
//             const json = JSON.parse(data);
//             if (json.choices[0].finish_reason != null) {
//               controller.close();
//               return;
//             }
//             const text = json.choices[0].delta.content;
//             const queue = encoder.encode(text);
//             controller.enqueue(queue);
//           } catch (e) {
//             controller.error(e);
//           }
//         }
//       };

//       const parser = createParser(onParse);

//       for await (const chunk of res.body as any) {
//         parser.feed(decoder.decode(chunk));
//       }
//     },
//   });

//   return stream;
// };
