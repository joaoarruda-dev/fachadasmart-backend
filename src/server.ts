import { app } from "./app";
import { config } from "./config/env";

app.listen(config.PORT, () =>
    console.log(`Servidor rodando em http://localhost:${config.PORT}`)
);
