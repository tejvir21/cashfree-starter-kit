import { createApp } from './app';
import { env } from './config/env';
const app = createApp();
app.listen(env.PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${env.PORT} (${env.NODE_ENV}, cashfree: ${env.CASHFREE_ENVIRONMENT})`);
});
