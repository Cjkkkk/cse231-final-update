import { BinOp, Expr, Stmt, Type, UniOp } from "./ast";

type FunctionsEnv = Map<string, [Type[], Type]>;
type BodyEnv = Map<string, Type>;

export function tcExpr(e : Expr<any>, functions : FunctionsEnv, variables : BodyEnv) : Expr<Type> {
    switch(e.tag) {
        case "literal":
        if( e.value.tag == "num") {
            return { ...e, a: Type.Int };
        } else if (e.value.tag == "true") {
            return { ...e, a: Type.Bool }; 
        } else if (e.value.tag == "false") {
            return { ...e, a: Type.Bool };
        } else {
            // TODO: fix none
            return { ...e, a: Type.None };
        }
        case "binary": {
            switch(e.op) {
                case BinOp.Plus: return { ...e, a: Type.Int };
                case BinOp.Minus: return { ...e, a: Type.Int };
                case BinOp.Mul: return { ...e, a: Type.Int };
                case BinOp.Div: return { ...e, a: Type.Int };
                case BinOp.Mod: return { ...e, a: Type.Int };
                case BinOp.Equal: return { ...e, a: Type.Bool };
                case BinOp.Unequal: return { ...e, a: Type.Bool };
                case BinOp.Gt: return { ...e, a: Type.Bool };
                case BinOp.Ge: return { ...e, a: Type.Bool };
                case BinOp.Lt: return { ...e, a: Type.Bool };
                case BinOp.Le: return { ...e, a: Type.Bool };
                case BinOp.Is: return { ...e, a: Type.Bool };
                //default: throw new Error(`Unhandled op ${e.op}`)
            }
        }

        case "unary": {
            switch(e.op) {
                case UniOp.Not: return { ...e, a: Type.Bool };
                case UniOp.Neg: return { ...e, a: Type.Int };
            }
        }
        case "name": return { ...e, a: variables.get(e.name) };
        case "call":
            if(e.name === "print") {
                if(e.args.length !== 1) { throw new Error("print expects a single argument"); }
                const newArgs = [tcExpr(e.args[0], functions, variables)];
                const res : Expr<Type> = { ...e, a: Type.None, args: newArgs } ;
                return res;
            }
            if(!functions.has(e.name)) {
                throw new Error(`function ${e.name} not found`);
            }

            const [args, ret] = functions.get(e.name);
            if(args.length !== e.args.length) {
                throw new Error(`Expected ${args.length} arguments but got ${e.args.length}`);
            }

            const newArgs = args.map((a, i) => {
                const argtyp = tcExpr(e.args[i], functions, variables);
                if(a !== argtyp.a) { throw new Error(`Got ${argtyp} as argument ${i + 1}, expected ${a}`); }
                return argtyp
            });

            return { ...e, a: ret, args: newArgs };
    }
}

export function tcStmt(s : Stmt<any>, functions : FunctionsEnv, variables : BodyEnv, currentReturn : Type) : Stmt<Type> {
    switch(s.tag) {
        case "assign": {
            const rhs = tcExpr(s.value, functions, variables);
            if(variables.has(s.name) && variables.get(s.name) !== rhs.a) {
                throw new Error(`Cannot assign ${rhs} to ${variables.get(s.name)}`);
            }
            else {
                variables.set(s.name, rhs.a);
            }
            return { ...s, value: rhs };
        }
        case "define": {
            const bodyvars = new Map<string, Type>(variables.entries());
            s.params.forEach(p => { bodyvars.set(p.name, p.type)});
            const newStmts = s.body.map(bs => tcStmt(bs, functions, bodyvars, s.ret));
            return { ...s, body: newStmts };
        }
        case "expr": {
            const ret = tcExpr(s.expr, functions, variables);
            return { ...s, expr: ret };
        }
        case "return": {
            const valTyp = tcExpr(s.value, functions, variables);
            if(valTyp.a !== currentReturn) {
                throw new Error(`${valTyp} returned but ${currentReturn} expected.`);
            }
            return { ...s, value: valTyp };
        }
    }
}

export function tcProgram(p : Stmt<any>[]) : Stmt<Type>[] {
    const functions = new Map<string, [Type[], Type]>();
    p.forEach(s => {
        if(s.tag === "define") {
            functions.set(s.name, [s.params.map(p => p.type), s.ret]);
        }
    });

    const globals = new Map<string, Type>();
    return p.map(s => {
        if(s.tag === "assign") {
            const rhs = tcExpr(s.value, functions, globals);
            globals.set(s.name, rhs.a);
            return { ...s, value: rhs };
        }
        else {
            const res = tcStmt(s, functions, globals, Type.None);
            return res;
        }
    });
}