import axios, { AxiosRequestConfig } from "axios";
import {
  SIGNALWIRE_API_TOKEN,
  SIGNALWIRE_CONTEXT,
  SIGNALWIRE_PROJECT_ID,
  SIGNALWIRE_SPACE,
} from "../constants";
import { typeCheck } from "../helpers";

const ENDPOINT = `https://${SIGNALWIRE_SPACE}/api/relay/rest`;

export type PhoneID = string & { _phoneID: never };
export type PhoneNumber = string & { _phoneNumber: never };

interface EndpointResult {
  getAvailablePhoneNumbers: {
    data: {
      e164: PhoneNumber;
    }[];
  };
  buyPhoneNumber: {
    id: PhoneID;
    number: PhoneNumber;
    capabilities: ("voice" | "fax" | "sms" | "mms")[];
  };
  updatePhoneContext: {};
}

type Endpoint = keyof EndpointResult;
const ENDPOINT_PARAMETERS = {
  getAvailablePhoneNumbers: () => ({
    method: "GET" as const,
    url: `${ENDPOINT}/phone_numbers/search`,
    params: {
      number_type: "local",
      max_results: 100,
    },
  }),
  buyPhoneNumber: (number: PhoneNumber) => ({
    method: "POST" as const,
    url: `${ENDPOINT}/phone_numbers`,
    data: { number },
  }),
  updatePhoneContext: (number: PhoneNumber, id: PhoneID) => ({
    method: "PUT" as const,
    url: `${ENDPOINT}/phone_numbers/${id}`,
    data: {
      name: number, // actually is required
      message_handler: "relay_context",
      message_relay_context: SIGNALWIRE_CONTEXT,
    },
  }),
} as const;
typeCheck<
  Record<Endpoint, (...args: never[]) => Omit<AxiosRequestConfig, "auth">>
>(ENDPOINT_PARAMETERS);

export default class SignalWireREST {
  private constructor() {}

  static async #apiCall<T extends Endpoint>(
    endpoint: T,
    ...data: Parameters<typeof ENDPOINT_PARAMETERS[T]>
  ): Promise<EndpointResult[T]> {
    // @ts-ignore
    const params = ENDPOINT_PARAMETERS[endpoint](...data);

    return (
      await axios({
        auth: {
          username: SIGNALWIRE_PROJECT_ID,
          password: SIGNALWIRE_API_TOKEN,
        },
        ...params,
      })
    ).data;
  }

  static async #getAvailablePhoneNumbers() {
    const response = await this.#apiCall("getAvailablePhoneNumbers");
    return response.data;
  }

  static async #getAvailablePhoneNumber() {
    return (await this.#getAvailablePhoneNumbers())[0].e164;
  }

  static async buyPhoneNumber() {
    const phoneNumber = await this.#getAvailablePhoneNumber();
    const buyResponse = await this.#apiCall("buyPhoneNumber", phoneNumber);

    const { id: phoneID } = buyResponse;
    await this.#apiCall("updatePhoneContext", phoneNumber, phoneID);

    return phoneNumber;
  }
}
