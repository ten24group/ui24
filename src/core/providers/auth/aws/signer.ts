import { Sha256 } from "@aws-crypto/sha256-js";
import { SignatureV4 } from "@smithy/signature-v4";
import { HttpRequest } from "@smithy/protocol-http";

import type { HeaderBag, QueryParameterBag, AwsCredentialIdentity } from "@smithy/types";

import { isValidURL, addPathToUrl } from "../../../utils";

type UseSignerOptions = {service ?: string, region ?: string};

export type SignRequestOptions = {
    credentials: AwsCredentialIdentity,
    url: string, 
    method: string, 
    data: any,
    baseUrl?: string,
}

export const useRequestSigner = (options: UseSignerOptions) => {
    const { service = "execute-api", region = "us-east-1" } = options;

    const signRequest = async (options: SignRequestOptions): Promise<HttpRequest> => {

        let { url: apiUrlOrEndpoint, method, credentials } = options;
        const { data, baseUrl } = options;

        if(!isValidURL(apiUrlOrEndpoint)){
            if(!baseUrl){
                throw new Error("No baseUrl provided in options");
            }
            apiUrlOrEndpoint = addPathToUrl(baseUrl, apiUrlOrEndpoint);
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
                'content-type': ''
            }
        }
        
        if(['POST', 'PATCH', 'PUT'].includes( method )) {
            payload.body = JSON.stringify(data);
            payload.headers['content-type'] = 'application/json';
        }

        const req = new HttpRequest(payload);
        const signer = new SignatureV4({
            credentials,
            region,
            service,
            sha256: Sha256,
        });

        const signed = await signer.sign(req);

        console.log("signed request ", {signed, payload});

        return signed as HttpRequest;

    }

    return {
        signRequest,
        signedHeaders: async (options: SignRequestOptions) => {
            const signedReq = await signRequest(options);

            const filteredHeaders = Object.entries(signedReq.headers).filter(([k,v]) => {
                // browsers prevent from setting `host` header
                return k.toLowerCase() !== "host";
            }).reduce((acc, [k,v]) => {
                acc[k] = v;
                return acc;
            }, {} as HeaderBag);

            return filteredHeaders;
        },
    }
}

export type RequestSigner = ReturnType<typeof useRequestSigner>;
