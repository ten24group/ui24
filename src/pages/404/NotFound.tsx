import React from "react"
import { useAuth } from "../../core/context";
import { PostAuthPage } from "../PostAuth/PostAuthPage";

export const NotFound = () => {
    const { isLoggedIn } = useAuth();

    return isLoggedIn ? <PostAuthPage pageTitle="Page Not Found">
        <></>
    </PostAuthPage> : 
        <h3 style={{ textAlign: "center"}}>404</h3>
}