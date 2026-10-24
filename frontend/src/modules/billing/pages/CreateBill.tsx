import { PageHeader } from "../../../components/ui";
import { BillBuilder } from "../components/BillBuilder";
export default function CreateBill() { return <div className="space-y-6"><PageHeader title="Create Bill" description="Build consultation, procedure, pharmacy, package, or other bills with receipt preview." /><BillBuilder /></div>; }
