import { AlertTriangle, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"

export function DeleteAccountCard() {
  const handleDeleteAccount = () => {
    // @todo Extension Point: Add modal confirmation and delete API call
  }

  return (
    <Card className="border-danger/30 overflow-hidden">
      <div className="flex flex-col md:flex-row gap-8 p-6">
        {/* Header Section - 1/3 width on md+ */}
        <div className="md:w-1/3 space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-danger/10 text-danger">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <CardTitle className="text-danger">Delete Account</CardTitle>
          </div>
          <CardDescription>
            Permanently deactivate or delete your account. This action cannot be
            undone and all of your data will be permanently removed.
          </CardDescription>
        </div>

        {/* Content Section - 2/3 width on md+ */}
        <div className="md:w-2/3 flex flex-col sm:flex-row items-center gap-3 md:justify-end">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleDeleteAccount}
          >
            Deactivate account
          </Button>
          <Button
            variant="destructive"
            className="w-full sm:w-auto bg-danger hover:bg-danger/90 text-white"
            onClick={handleDeleteAccount}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete account
          </Button>
        </div>
      </div>
    </Card>
  )
}
