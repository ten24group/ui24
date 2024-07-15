import { IConfigResolver } from '../core/context';

export const loadConfigs = async <T extends IConfigResolver<any>[]>(...props: IConfigResolver<any>[]): Promise<T>  => {
    const configs = await Promise.all( 
        props.map( async (prop) => { 
            if( typeof prop === 'function' ) {
                return await prop()
            } else if( typeof prop === 'string' ) {
                const config = await fetch(prop);
                const resolved = await config.json();
                return resolved;
            } else if( typeof prop === 'object' ) {
                return prop
            }
        }) 
    );
    return configs as T;
}