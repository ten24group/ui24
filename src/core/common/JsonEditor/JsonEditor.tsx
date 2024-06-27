import React from "react";
import { JsonEditor as Editor } from "react-jsondata-editor"
import { isValidJson } from '../../utils';

export const JsonEditor = ({ initObject, onChange }) => {
    try {
        return isValidJson(JSON.stringify(initObject)) ? (
            <Editor
                jsonObject={JSON.stringify(initObject)}
                onChange={(data) => onChange( JSON.parse(data) )}
            />
        ) : null;
    } catch (error) {
        // Handle the error here
        console.error("An error occurred while rendering the JSON editor:", error);
        return null;
    }
}