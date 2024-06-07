import * as dayjs from 'dayjs'

import dayjsUTCPlugin from 'dayjs/plugin/utc';
import dayjsTimezonePlugin from 'dayjs/plugin/timezone';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(dayjsUTCPlugin);
dayjs.extend(dayjsTimezonePlugin);
dayjs.extend(dayjsCustomParseFormat);

export { dayjs as dayjsCustom };