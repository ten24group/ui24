import React from 'react';
import { AppRouter, IAppRouter } from '../routes/AppRouter';

const UI24 = ({ customRoutes = [] }: IAppRouter ) => {
    return <AppRouter customRoutes = { customRoutes } />
}
export { UI24 };