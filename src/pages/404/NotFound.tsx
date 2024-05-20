import React from "react"
import { UI24Config } from '../../core';
import { useAuth } from '../../core';
import { PostAuthPage } from "../PostAuth/PostAuthPage";
import { PreAuthLayout } from "../../layout";

export const NotFound = () => {
    const { isLoggedIn } = useAuth();

    return isLoggedIn ? <PostAuthPage pageTitle="Page Not Found">
        <></>
    </PostAuthPage> : <PreAuthLayout>
        <h3 style={{ textAlign: "center"}}>404</h3>
    </PreAuthLayout>
}