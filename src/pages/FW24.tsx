import React from 'react';
import { AppRouter, IAppRouter } from '../routes/AppRouter';

const FW24 = ({ customRoutes = [] }: IAppRouter ) => {
    return <AppRouter customRoutes = { customRoutes } />
}
export { FW24 };