import React from "react";

import "../styles.scss";
import Frame from "./Frame";

export default function App() {
    return <Frame>
        <h1>Loading</h1><span className="loader"></span>
    </Frame>;
}
