import { Sha256 } from "@aws-crypto/sha256-js";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";

import type { HeaderBag, QueryParameterBag } from "@smithy/types";

import { useAuth } from "./config";
import { isValidURL, makeProperUrl } from "../utils";

const auth = useAuth();

type UseSignerOptions = {service ?: string, region ?: string};
type SignRequestOptions = {
    url: string, 
    method: string, 
    data: any,
    baseUrl?: string,
}

export const useSigner = (options: UseSignerOptions) => {
    const { service = "execute-api", region = "us-east-1" } = options;

    const signRequest = async (options: SignRequestOptions): Promise<HeaderBag> => {

        let { url: apiUrlOrEndpoint, method } = options;
        const { data, baseUrl } = options;

        if(!isValidURL(apiUrlOrEndpoint)){
            if(!baseUrl){
                throw new Error("No baseUrl provided in options");
            }
            apiUrlOrEndpoint = makeProperUrl(baseUrl, apiUrlOrEndpoint);
        }
        method = method.toUpperCase();

        
        const parsedUrl = new URL(apiUrlOrEndpoint);
        
        if(method === 'GET' && !!data && typeof data === 'object' ){
            Object.entries(data).forEach(([k,v]) => {
                parsedUrl.searchParams.append(k, v as string);
            });
        }
        
        const endpoint = parsedUrl.hostname.toString();
        const path = parsedUrl.pathname.toString();
        
        const queryParams: QueryParameterBag = {};
        parsedUrl.searchParams.forEach((value, key) => {
            queryParams[key] = value;
        });

        type HttpRequestOptions = {
            method: string;
            hostname: string;
            protocol?: string;
            port?: number;
            path: string;
            query: QueryParameterBag;
            body?: any;
            headers: HeaderBag;
            username?: string;
            password?: string;
            fragment?: string;
        }
    
        const payload: HttpRequestOptions = {
            hostname: endpoint,
            path,
            method,
            query: queryParams,
            headers: {
                host: endpoint,
                'Content-Type': ''
            }
        }
        
        if(['POST', 'PATCH', 'PUT'].includes( method )) {
            payload.body = JSON.stringify(data);
            payload.headers['Content-Type'] = 'application/json';
        }

        const req = new HttpRequest(payload);

        console.log("signing request payload", payload);
        
        if(auth.isLoggedIn()){
            const credentials = await auth.getCredentials();
            const signer = new SignatureV4({
                credentials: credentials,
                sha256: Sha256,
                region,
                service,
            });
            const signed = await signer.sign(req);
            return signed.headers;
        }
        
        return req.headers;
    }

    return {
        sign: async (options: SignRequestOptions) => {
            const headers = await signRequest(options);

            console.log("signed headers", headers);

            const filtered = Object.entries(headers).filter(([k,v]) => {
                return k.toLowerCase()!== "host";
            }).reduce((acc, [k,v]) => {
                acc[k] = v;
                return acc;
            }, {} as HeaderBag);

            return filtered;
        },
    }
}