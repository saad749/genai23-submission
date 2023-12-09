import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { OpenAIError, OpenAIStream } from '@/utils/server';

import { ChatBody, Message } from '@/types/chat';

// @ts-expect-error
import wasm from '../../node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm?module';

import tiktokenModel from '@dqbd/tiktoken/encoders/cl100k_base.json';
import { Tiktoken, init } from '@dqbd/tiktoken/lite/init';

export const config = {
  runtime: 'edge',
};

const handler = async (req: Request): Promise<Response> => {
  try {
    const { model, messages, key, prompt, temperature } = (await req.json()) as ChatBody;

    await init((imports) => WebAssembly.instantiate(wasm, imports));
    const encoding = new Tiktoken(
      tiktokenModel.bpe_ranks,
      tiktokenModel.special_tokens,
      tiktokenModel.pat_str,
    );

    let promptToSend = prompt;
    if (!promptToSend) {
      promptToSend = DEFAULT_SYSTEM_PROMPT;
    }

    let temperatureToUse = temperature;
    if (temperatureToUse == null) {
      temperatureToUse = DEFAULT_TEMPERATURE;
    }

    const prompt_tokens = encoding.encode(promptToSend);

    let tokenCount = prompt_tokens.length;
    let messagesToSend: Message[] = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const tokens = encoding.encode(message.content);

      if (tokenCount + tokens.length + 1000 > model.tokenLimit) {
        break;
      }
      tokenCount += tokens.length;
      messagesToSend = [message, ...messagesToSend];
    }

    encoding.free();


    const postData = {
      quiz_length: 3,
      current_question: 0,
      score: 0
    };

    const flaskApiUrl = 'http://127.0.0.1:5000/question';
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
    //console.log(responseJSON);

    // Let's assume responseJSON has a property named 'data' you want to store
    const propertiesToStore = responseJSON.data;
    //console.log("!!!!!!!!!--- Calling local storage");
    // Store the properties in localStorage
    //localStorage.setItem('apiProperties', JSON.stringify(propertiesToStore));
    //console.log("@###--- After call");
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

    //const stream = await OpenAIStream(model, promptToSend, temperatureToUse, key, messagesToSend);

    return new Response(stream);
  } catch (error) {
    console.error(error);
    if (error instanceof OpenAIError) {
      return new Response('Error', { status: 500, statusText: error.message });
    } else {
      return new Response('Error', { status: 500 });
    }
  }
};

export default handler;
