import React from 'react';
import { PostAuthPage } from '../PostAuth/PostAuthPage';
import { useParams } from "react-router-dom"

import { FW24Config } from '../../core';

export const DynamicPage = () => {
    //get routes from URL
    const { dynamicPage = "", dynamicID = ""} = useParams()

    let pageConfig = FW24Config.pageConfig[dynamicPage]
    //check if page config exists for the route
    if( !pageConfig ){
        //Fallback : make API call to get page config
    }

    if( !pageConfig ){
        return <h3>404</h3>
    }

    return <PostAuthPage {...pageConfig} />;
}