import { parser } from "lezer-python";
import { stringifyTree } from "./treeprinter";
import { parse } from "./parser";
import { compile } from "./compiler";

var source = `
if a > 1:
    a = 1
elif a < 1:
    a = 2
else:
    a = 3

pass
`


source = `
def f(a:int, b:int) -> int:
    a = a + b
    b = b + a
    return a
`

source = `
while a > 1:
    a = 1
    b = 2
`



source = `
if c > 10:
    c = 11
else:
    c = 22
`

source = `
x: int = 1
x = x + 1
`

source = `
def f1() -> int:
    test: int = 1
    return test
`

source = `
class A:
    a: int = 1
    b: bool = True
    def new(self: A, a: int, b: bool):
        self.a = a
        self.b = b

a:A = None
a.new(4, True)
a.a
`

// // Script
// //   ExpressionStatement
// //     MemberExpression
// //       MemberExpression
// //         VariableName-->a
// //         .
// //         PropertyName
// //       .
// //       PropertyName

// source = `
// a.A.A
// `

// // Script
// //   ExpressionStatement
// //     CallExpression-->a.A.A()
// //       MemberExpression
// //         MemberExpression
// //           VariableName-->a
// //           .
// //           PropertyName-->A
// //         .
// //         PropertyName-->A
// //       ArgList
// //         (
// //         )
// source = `
// a.A.A()
// `

// // Script
// //   ExpressionStatement
// //     CallExpression-->A()
// //       VariableName-->A
// //       ArgList
// //         (
// //         )

// source = `
// A()
// `


// // Script
// //   ExpressionStatement
// //     CallExpression-->a.A()
// //       MemberExpression
// //         VariableName-->a
// //         .
// //         PropertyName-->A
// //       ArgList
// //         (
// //         )

// source = `
// a.A()
// `

// // Script
// //   ExpressionStatement
// //     CallExpression-->a.A().B()
// //       MemberExpression
// //         CallExpression-->a.A()
// //           MemberExpression
// //             VariableName-->a
// //             .
// //             PropertyName-->A
// //           ArgList
// //             (
// //             )
// //         .
// //         PropertyName-->B
// //       ArgList
// //         (
// //         )

// source = `
// a.!().B()
// `
const t = parser.parse(source);
console.log(stringifyTree(t.cursor(), source, 0));

// const stmts = parse(source);
// console.log(stmts)
console.log(compile(source))