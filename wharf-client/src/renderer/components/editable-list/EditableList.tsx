import React, { createRef } from "react";

interface EditableListProps {
    items: string[];
    type: string;
    webkitdirectory?: boolean;
    addItem: (value: string) => void;
    removeItem: (item: string) => void;
}

class EditableList extends React.Component<EditableListProps, {}> {
    private input = createRef<HTMLInputElement>();

    componentDidMount() {
        if (this.props.webkitdirectory) {
            (this.input.current as any).webkitdirectory = true;
        }
    }

    render() {
        return <div>
            <div>
                <input className="input" type={this.props.type} ref={this.input}/>
                <button className="button is-success" onClick={() => this.props.addItem(this.getInputValue())}>+</button>
            </div>
            <ul>
                {this.props.items.map(item => {
                    console.log(item);
                    return <li key={item}>{item} <button className="button is-danger" onClick={() => this.props.removeItem(item)}>x</button></li>;
                })}
            </ul>
        </div>;    
    }

    getInputValue() {
        if (this.props.type == "file") {
            return (this.input.current as any).files[0].path.trim();
        }
        return (this.input.current as any).value;
    }
}

export default EditableList;
