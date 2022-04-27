import { compile, run as runT} from '../compiler';
import { parse } from "../parser";
import { tcProgram } from "../tc";
import { ExprStmt } from "../ast";
import { importObject } from './import-object.test';


// Modify typeCheck to return a `Type` as we have specified below
export function typeCheck(source: string) : Type {
    const stmts = parse(source);
    const newStmts = tcProgram(stmts);
    const lastStmt = newStmts[newStmts.length - 1];
    if (lastStmt.tag !== "expr") {
        return "none"
    }
    const lastType = (lastStmt as ExprStmt<any>).expr.a;
    if (lastType === "int" || lastType === "bool" || lastType === "none") return lastType;
    else {
        return {tag: "object", class: lastType};
    }
}



// Modify run to use `importObject` (imported above) to use for printing
export async function run(source: string) {
    const wasmSource = compile(source);
    try {
        const v = await runT(wasmSource, importObject);
        return v;
    } catch (err){
        throw new Error("RUNTIME ERROR: " + err.message)
    }
}


type Type =
  | "int"
  | "bool"
  | "none"
  | { tag: "object", class: string }

export const NUM : Type = "int";
export const BOOL : Type = "bool";
export const NONE : Type = "none";
export function CLASS(name : string) : Type { 
    return { tag: "object", class: name }
};
