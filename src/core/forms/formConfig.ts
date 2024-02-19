import { ICreateButtons } from "./buttons/Buttons";
import { IFormField } from "./formfields/formField";

interface IFormConfig {
    name: string;
    className?: string;
    initialValues?: any;
}
  
interface ICustomForm extends ICreateButtons {
    formConfig?: IFormConfig;
    propertiesConfig: Array<IFormField>;
    onSubmit: (values: any) => void;
}



export { IFormConfig, ICustomForm }