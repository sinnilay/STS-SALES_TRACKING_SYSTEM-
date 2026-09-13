using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace STS.Migrations
{
    /// <inheritdoc />
    public partial class AddStsAllocationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AllocatedToId",
                table: "SalesRecords",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AllocatorComment",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SalesRecords_AllocatedToId",
                table: "SalesRecords",
                column: "AllocatedToId");

            migrationBuilder.AddForeignKey(
                name: "FK_SalesRecords_Users_AllocatedToId",
                table: "SalesRecords",
                column: "AllocatedToId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SalesRecords_Users_AllocatedToId",
                table: "SalesRecords");

            migrationBuilder.DropIndex(
                name: "IX_SalesRecords_AllocatedToId",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "AllocatedToId",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "AllocatorComment",
                table: "SalesRecords");
        }
    }
}
