import React, { Props } from "react";

export default function Frame(props: Props<any>) {
    return <section className="section">
        <div className="container">
            {props.children}
        </div>
    </section>;
}
