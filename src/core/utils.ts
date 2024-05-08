export function isValidURL(str) {
  var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return !!pattern.test(str);
}

export function makeProperUrl(baseURL: string, endpoint: string) {
    if(!isValidURL(baseURL) ){
        throw new Error(`Invalid base URL: ${baseURL}`);
    }

    const newUrl = new URL( `./${endpoint}`.replace('//', '/'), baseURL);

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