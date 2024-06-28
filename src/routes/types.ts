import { ReactNode } from 'react';
export type IRouteAuthType = "auth" | "public" | "private"
export type IRoute = {
    path: string;
    element?: ReactNode;
    authType?: IRouteAuthType;
}

export type IRoutes = Array<IRoute>