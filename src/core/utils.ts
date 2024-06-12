export function isValidURL(str) {
  var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return !!pattern.test(str);
}

export function replaceAll(target: string, search: string, replacement: string){
  return target.split(search).join(replacement);
}

export function addPathToUrl(baseURL: string, endpoint: string) {
    if(!isValidURL(baseURL) ){
        throw new Error(`Invalid base URL: ${baseURL}`);
    }

    // make sure base url ends with a slash and endpoint always starts with a slash `/` 
    if( !baseURL.endsWith('/') ){
        baseURL = `${baseURL}/`
    }

    // Make sure path does-not end with a trailing-slash `/` 
    // [AWS signature needs the exact path (with or without slash)]
    // And API gateway strips teh training slash from the API-endpoint
    // * we need to make sure that API, Auth-policy, and Frontend-code all follow the same convention
    endpoint = replaceAll(`./${endpoint}`, '//', '/');
    endpoint = endpoint.endsWith('/') ? endpoint.slice(0,-1) : endpoint;

    const newUrl = new URL(endpoint, baseURL);

    return newUrl.toString();
}

export function convertUTCDateToLocalDate(date: string | Date) {
    if(typeof date ==='string'){
        date = new Date(date);
    }

    var newDate = new Date(date);
    newDate.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return newDate;
}





